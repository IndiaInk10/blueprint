import { z } from 'zod';
import { describeZodError, schemaVersionProblem } from '@guide/content-tools';
import {
  CONTENT_SCHEMA_VERSION,
  combosSchema,
  customizationSchema,
  equipmentKey,
  loadoutsSchema,
  manifestSchema,
  missionCatalogSchema,
  perkCatalogSchema,
  ratingsSchema,
  stratagemCatalogSchema,
  warbondCatalogSchema,
  weaponCatalogSchema,
  type ContentManifest,
  type EquipmentKind,
  type Hd2Content,
  type Kit,
  type Loadout,
  type Obtain,
} from './schema';

/** Raw documents keyed by a name used only in error messages. Each says what it is via `kind`. */
export type RawContent = Record<string, unknown>;

/** Cross-references z.object cannot express, for anything with the full set of slots. */
export function checkKit(loadout: Kit, content: Omit<Hd2Content, 'manifest'>, where: string): string[] {
  const problems: string[] = [];
  const expectWeapon = (slot: 'primary' | 'secondary' | 'throwable') => {
    const weapon = content.weapons[loadout[slot]];
    if (!weapon) problems.push(`${where}: unknown ${slot} "${loadout[slot]}"`);
    else if (weapon.slot !== slot) problems.push(`${where}: "${loadout[slot]}" is a ${weapon.slot}, not a ${slot}`);
  };
  expectWeapon('primary');
  expectWeapon('secondary');
  expectWeapon('throwable');

  if (new Set(loadout.stratagems).size !== loadout.stratagems.length) problems.push(`${where}: duplicate stratagem`);
  for (const stratagem of loadout.stratagems) {
    if (!content.stratagems[stratagem]) problems.push(`${where}: unknown stratagem "${stratagem}"`);
    else if (content.stratagems[stratagem].category === 'mission') problems.push(`${where}: "${stratagem}" is a mission stratagem`);
  }
  // A backpack and a support weapon that needs its own backpack both take the one backpack slot.
  const backpacks = loadout.stratagems.filter((s) => {
    const stratagem = content.stratagems[s];
    return stratagem?.category === 'backpack' || stratagem?.requiresBackpack === true;
  });
  if (backpacks.length > 1) problems.push(`${where}: ${backpacks.join(' and ')} both need the backpack slot`);
  if (!content.armorPassives[loadout.armorPassive]) problems.push(`${where}: unknown armor passive "${loadout.armorPassive}"`);
  if (loadout.booster && !content.boosters[loadout.booster]) problems.push(`${where}: unknown booster "${loadout.booster}"`);
  return problems;
}

export function checkLoadout(loadout: Loadout, content: Omit<Hd2Content, 'manifest'>): string[] {
  const where = `loadout ${loadout.id}`;
  const problems = checkKit(loadout, content, where);

  if (!content.factions.some((f) => f.id === loadout.faction)) problems.push(`${where}: unknown faction "${loadout.faction}"`);
  for (const mission of loadout.missionTypes) {
    const type = content.missionTypes.find((m) => m.id === mission);
    if (!type) problems.push(`${where}: unknown mission type "${mission}"`);
    else if (!type.factions.includes(loadout.faction)) problems.push(`${where}: mission "${mission}" does not appear for ${loadout.faction}`);
  }
  return problems;
}

type WarbondCatalog = z.infer<typeof warbondCatalogSchema>;
type Catalogs = Pick<Hd2Content, 'weapons' | 'stratagems' | 'armorPassives' | 'boosters'>;

function catalogHas(content: Catalogs, kind: EquipmentKind, entryId: string): boolean {
  const catalog = { weapon: content.weapons, stratagem: content.stratagems, armor: content.armorPassives, booster: content.boosters }[kind];
  return entryId in catalog;
}

/** Every way to get each piece of equipment: warbond pages and the ship's requisition list. */
function buildObtain(
  content: Omit<Hd2Content, 'manifest' | 'obtain'>,
  { superstore, rewards }: Pick<WarbondCatalog, 'superstore' | 'rewards'>,
  problems: string[],
): Hd2Content['obtain'] {
  const obtain: Hd2Content['obtain'] = {};
  const add = (kind: EquipmentKind, entryId: string, source: Obtain) => {
    (obtain[equipmentKey(kind, entryId)] ??= []).push(source);
  };
  for (const warbond of content.warbonds) {
    for (const page of warbond.pages) {
      for (const item of page.items) {
        const where = { via: 'warbond' as const, warbond: warbond.id, page: page.page, medals: item.medals, medalsToUnlock: page.medalsToUnlock };
        const kind: EquipmentKind | null = item.kind === 'weapon' || item.kind === 'stratagem' || item.kind === 'booster' ? item.kind : null;
        if (kind && item.ref) {
          if (!catalogHas(content, kind, item.ref)) problems.push(`warbond ${warbond.id}: unknown ${kind} "${item.ref}"`);
          add(kind, item.ref, where);
        }
        if (item.armorPassive) {
          if (!content.armorPassives[item.armorPassive]) problems.push(`warbond ${warbond.id}: unknown armor passive "${item.armorPassive}"`);
          add('armor', item.armorPassive, where);
        }
      }
    }
  }
  for (const stratagem of Object.values(content.stratagems)) {
    if (stratagem.unlock) add('stratagem', stratagem.id, { via: 'requisition', ...stratagem.unlock });
  }
  for (const offer of superstore) {
    if (!catalogHas(content, offer.kind, offer.ref)) problems.push(`superstore: unknown ${offer.kind} "${offer.ref}"`);
    add(offer.kind, offer.ref, { via: 'superstore', name: offer.name, superCredits: offer.superCredits });
  }
  for (const reward of rewards) {
    if (!catalogHas(content, reward.kind, reward.ref)) problems.push(`rewards: unknown ${reward.kind} "${reward.ref}"`);
    add(reward.kind, reward.ref, { via: 'reward', how: reward.how });
  }
  return obtain;
}

/** Validates and merges raw documents. Throws with every problem listed. */
export function parseContent(raw: unknown): Hd2Content {
  const documents = z.record(z.string(), z.unknown()).parse(raw);
  const problems: string[] = [];
  const manifests: ContentManifest[] = [];
  const content: Omit<Hd2Content, 'manifest'> = {
    weapons: {},
    stratagems: {},
    armorPassives: {},
    boosters: {},
    factions: [],
    missionCategories: [],
    missionTypes: [],
    loadouts: [],
    combos: [],
    sources: [],
    ratings: {},
    warbonds: [],
    currencies: [],
    obtain: {},
    customization: { system: null, slots: [], attachments: {}, builds: {} },
  };

  const offers: Pick<WarbondCatalog, 'superstore' | 'rewards'> = { superstore: [], rewards: [] };
  const parse = <T>(schema: z.ZodType<T>, name: string, document: unknown): T | null => {
    const result = schema.safeParse(document);
    if (result.success) return result.data;
    problems.push(describeZodError(name, result.error));
    return null;
  };
  const addAll = <T extends { id: string }>(target: Record<string, T>, list: T[], name: string, what: string) => {
    for (const entry of list) {
      if (target[entry.id]) problems.push(`${name}: duplicate ${what} "${entry.id}"`);
      target[entry.id] = entry;
    }
  };

  for (const [name, document] of Object.entries(documents).sort(([a], [b]) => a.localeCompare(b))) {
    const tooNew = schemaVersionProblem(name, document, CONTENT_SCHEMA_VERSION);
    if (tooNew) {
      problems.push(tooNew);
      continue;
    }
    const kind = (document as { kind?: unknown } | null)?.kind;
    switch (kind) {
      case 'manifest': {
        const manifest = parse(manifestSchema, name, document);
        if (manifest) manifests.push(manifest);
        break;
      }
      case 'weapon-catalog':
        addAll(content.weapons, parse(weaponCatalogSchema, name, document)?.weapons ?? [], name, 'weapon');
        break;
      case 'stratagem-catalog':
        addAll(content.stratagems, parse(stratagemCatalogSchema, name, document)?.stratagems ?? [], name, 'stratagem');
        break;
      case 'perk-catalog': {
        const perks = parse(perkCatalogSchema, name, document);
        addAll(content.armorPassives, perks?.armorPassives ?? [], name, 'armor passive');
        addAll(content.boosters, perks?.boosters ?? [], name, 'booster');
        break;
      }
      case 'mission-catalog': {
        const missions = parse(missionCatalogSchema, name, document);
        content.factions.push(...(missions?.factions ?? []));
        content.missionCategories.push(...(missions?.missionCategories ?? []));
        content.missionTypes.push(...(missions?.missionTypes ?? []));
        break;
      }
      case 'loadouts': {
        const file = parse(loadoutsSchema, name, document);
        content.loadouts.push(...(file?.loadouts ?? []));
        content.sources.push(...(file?.sources ?? []));
        break;
      }
      case 'combos': {
        const file = parse(combosSchema, name, document);
        content.combos.push(...(file?.combos ?? []));
        content.sources.push(...(file?.sources ?? []));
        break;
      }
      case 'ratings': {
        const file = parse(ratingsSchema, name, document);
        for (const rating of file?.ratings ?? []) {
          const key = equipmentKey(rating.kind, rating.id);
          if (content.ratings[key]) problems.push(`${name}: duplicate rating "${key}"`);
          content.ratings[key] = rating;
        }
        content.sources.push(...(file?.sources ?? []));
        break;
      }
      case 'warbond-catalog': {
        const file = parse(warbondCatalogSchema, name, document);
        content.warbonds.push(...(file?.warbonds ?? []));
        content.currencies.push(...(file?.currencies ?? []));
        offers.superstore.push(...(file?.superstore ?? []));
        offers.rewards.push(...(file?.rewards ?? []));
        break;
      }
      case 'weapon-customization': {
        const file = parse(customizationSchema, name, document);
        if (!file) break;
        content.customization.system = file.system;
        content.customization.slots.push(...file.slots);
        addAll(content.customization.attachments, file.attachments, name, 'attachment');
        for (const build of file.weapons) content.customization.builds[build.weapon] = build;
        break;
      }
      default:
        problems.push(`${name}: unknown document kind ${JSON.stringify(kind)}`);
    }
  }

  if (manifests.length !== 1) problems.push(`expected exactly one manifest document, found ${manifests.length}`);
  const loadoutIds = new Set<string>();
  for (const loadout of content.loadouts) {
    if (loadoutIds.has(loadout.id)) problems.push(`duplicate loadout "${loadout.id}"`);
    loadoutIds.add(loadout.id);
    problems.push(...checkLoadout(loadout, content));
  }
  // Combos share the overlay selection with loadouts, so ids must not collide.
  for (const combo of content.combos) {
    if (loadoutIds.has(combo.id)) problems.push(`duplicate loadout or combo "${combo.id}"`);
    loadoutIds.add(combo.id);
    problems.push(...checkKit(combo, content, `combo ${combo.id}`));
    if (combo.focus === 'warbond' && !combo.warbond) problems.push(`combo ${combo.id}: a warbond combo names its warbond`);
    if (combo.warbond && !content.warbonds.some((w) => w.id === combo.warbond)) {
      problems.push(`combo ${combo.id}: unknown warbond "${combo.warbond}"`);
    }
    for (const faction of combo.bestAgainst) {
      if (!content.factions.some((f) => f.id === faction)) problems.push(`combo ${combo.id}: unknown faction "${faction}"`);
    }
  }
  for (const mission of content.missionTypes) {
    if (!content.missionCategories.some((c) => c.id === mission.category)) {
      problems.push(`mission ${mission.id}: unknown category "${mission.category}"`);
    }
    for (const faction of mission.factions) {
      if (!content.factions.some((f) => f.id === faction)) problems.push(`mission ${mission.id}: unknown faction "${faction}"`);
    }
  }
  content.sources = [...new Set(content.sources)];

  for (const [key, rating] of Object.entries(content.ratings)) {
    if (rating && !catalogHas(content, rating.kind, rating.id)) problems.push(`rating "${key}": not in the catalog`);
    for (const faction of Object.keys(rating?.factions ?? {})) {
      if (!content.factions.some((f) => f.id === faction)) problems.push(`rating "${key}": unknown faction "${faction}"`);
    }
  }
  const warbondIds = new Set<string>();
  for (const warbond of content.warbonds) {
    if (warbondIds.has(warbond.id)) problems.push(`duplicate warbond "${warbond.id}"`);
    warbondIds.add(warbond.id);
  }
  content.obtain = buildObtain(content, offers, problems);

  const { slots, attachments, builds } = content.customization;
  for (const attachment of Object.values(attachments)) {
    if (!slots.some((slot) => slot.id === attachment.slot)) problems.push(`attachment ${attachment.id}: unknown slot "${attachment.slot}"`);
  }
  for (const build of Object.values(builds)) {
    if (!content.weapons[build.weapon]) problems.push(`weapon build: unknown weapon "${build.weapon}"`);
    for (const [slot, attachment] of [...Object.entries(build.available).flatMap(([s, list]) => list.map((a) => [s, a] as const)), ...Object.entries(build.recommended)]) {
      const known = attachments[attachment];
      if (!known) problems.push(`weapon build ${build.weapon}: unknown attachment "${attachment}"`);
      else if (known.slot !== slot) problems.push(`weapon build ${build.weapon}: "${attachment}" does not go in ${slot}`);
    }
    for (const attachment of Object.keys(build.unlocks)) {
      if (!attachments[attachment]) problems.push(`weapon build ${build.weapon}: unlock for unknown attachment "${attachment}"`);
    }
  }

  if (problems.length > 0) throw new Error(`Invalid Helldivers 2 content:\n- ${problems.join('\n- ')}`);
  return { manifest: manifests[0]!, ...content };
}
