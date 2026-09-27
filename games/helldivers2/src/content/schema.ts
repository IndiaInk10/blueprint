import { z } from 'zod';
import {
  documentHeader,
  idSchema as id,
  imageFile,
  localizedText,
  manifestSchema,
  type ContentManifest,
} from '@guide/content-tools';

export { localizedText, manifestSchema, type ContentManifest };

/** Bump when the document format changes incompatibly; older apps then reject newer content. */
export const CONTENT_SCHEMA_VERSION = 1;

/**
 * Helldivers 2 packs its localization, so unlike games whose files we can read, display names
 * live in the content. Korean falls back to English when the official name is unknown.
 */
const name = localizedText;

export const direction = z.enum(['up', 'down', 'left', 'right']);
export const armorPen = z.enum(['light', 'medium', 'heavy', 'anti-tank']);

export const weaponCategory = z.enum([
  'assault-rifle',
  'marksman-rifle',
  'smg',
  'shotgun',
  'explosive',
  'energy',
  'pistol',
  'melee',
  'standard',
  'special',
]);

export const weaponTrait = z.enum([
  'incendiary',
  'arc',
  'explosive',
  'stun',
  'caustic',
  'beam',
  'heat',
  'chargeup',
  'guided',
  'sticky',
  'suppressed',
  'one-handed',
  'rounds-reload',
  'stimulative',
  'melee',
]);

export const weaponSchema = z.object({
  id,
  name,
  slot: z.enum(['primary', 'secondary', 'throwable']),
  category: weaponCategory,
  armorPen: armorPen.optional(),
  traits: z.array(weaponTrait).default([]),
  source: z.string().min(1).optional(),
  icon: imageFile.optional(),
  notes: localizedText.optional(),
});

export const stratagemCategory = z.enum([
  'support-weapon',
  'backpack',
  'orbital',
  'eagle',
  'sentry',
  'emplacement',
  'vehicle',
  'mission',
]);

export const stratagemSchema = z.object({
  id,
  name,
  category: stratagemCategory,
  /** Input sequence, e.g. ["down", "down", "up", "right"]. */
  code: z.array(direction).min(1).max(10),
  cooldown: z.number().nonnegative().optional(),
  /** Null means unlimited. */
  uses: z.number().int().positive().nullable().optional(),
  callInTime: z.number().nonnegative().optional(),
  armorPen: armorPen.optional(),
  requiresBackpack: z.boolean().optional(),
  /** Bought on the ship with requisition slips once the player reaches `level`. Warbond stratagems have none. */
  unlock: z.object({ level: z.number().int().min(0), requisition: z.number().int().min(0) }).optional(),
  source: z.string().min(1).optional(),
  icon: imageFile.optional(),
  notes: localizedText.optional(),
});

export const perkSchema = z.object({
  id,
  name,
  effect: localizedText,
  icon: imageFile.optional(),
});

export const factionSchema = z.object({
  id,
  name,
  /** What fighting this faction is like, and what a loadout needs against it. */
  summary: localizedText.optional(),
  priorities: z.array(localizedText).default([]),
});

/** Groups mission types by what they ask of a squad: kill everything, hold a position, and so on. */
export const missionCategorySchema = z.object({ id, name, demands: localizedText });

export const missionTypeSchema = z.object({
  id,
  name,
  category: id,
  factions: z.array(id).min(1),
  /** What the mission asks of a loadout. */
  demands: localizedText,
});

export const loadoutRole = z.enum([
  'generalist',
  'beginner',
  'solo',
  'anti-tank',
  'anti-air',
  'crowd-control',
  'objective',
  'defense',
  'team-support',
  'survivability',
  'stealth',
  'speed',
]);

/** What every kit has: the full set of slots a Helldiver brings, with notes. */
const kitFields = {
  id,
  title: localizedText,
  difficulty: z
    .object({ min: z.number().int().min(1).max(10), max: z.number().int().min(1).max(10) })
    .refine((d) => d.min <= d.max, 'min must be <= max'),
  primary: id,
  secondary: id,
  throwable: id,
  stratagems: z.array(id).length(4),
  armorPassive: id,
  booster: id.optional(),
  summary: localizedText,
  /** Why each slot is there. The four stratagems are explained together, as they work as a set. */
  slotNotes: z
    .object({
      primary: localizedText.optional(),
      secondary: localizedText.optional(),
      throwable: localizedText.optional(),
      armorPassive: localizedText.optional(),
      booster: localizedText.optional(),
      stratagems: localizedText.optional(),
    })
    .default({}),
  roles: z.array(loadoutRole).default([]),
};

export const kitSchema = z.object(kitFields);

/** A kit recommended for a faction and its missions. */
export const loadoutSchema = z.object({
  ...kitFields,
  faction: id,
  missionTypes: z.array(id).min(1),
});

export const comboTag = z.enum(['theme', 'roleplay', 'chaos', 'challenge', 'team', 'solo']);
/** What a combo is built around: a weapon family, one warbond, a stratagem type (vehicles included), or a squad role. */
export const comboFocus = z.enum(['weapon', 'warbond', 'stratagem', 'role']);

/** A themed kit picked for fun rather than strength. */
export const comboSchema = z.object({
  ...kitFields,
  focus: comboFocus,
  /** For warbond combos: the one warbond the kit comes from. */
  warbond: id.optional(),
  tagline: localizedText,
  whyFun: localizedText.optional(),
  /** Armor set that fits the look; any set with the same passive works. */
  armorSet: localizedText.optional(),
  /** Enemies it suits; empty means any. */
  bestAgainst: z.array(id).default([]),
  tags: z.array(comboTag).default([]),
});

// ---- ratings ------------------------------------------------------------------------------

export const tier = z.enum(['S', 'A', 'B', 'C', 'D']);
export const popularity = z.enum(['very-high', 'high', 'medium', 'low', 'rare']);
/** The catalogs a rating, a warbond item or an unlock can point at. */
export const equipmentKind = z.enum(['weapon', 'stratagem', 'armor', 'booster']);

export const ratingSchema = z.object({
  kind: equipmentKind,
  id,
  overall: tier,
  /** Per enemy faction, when it differs in a way worth showing. */
  factions: z.record(id, tier).default({}),
  popularity: popularity.optional(),
  /** Share of players using it, when the developers published one. */
  usagePercent: z.number().min(0).max(100).optional(),
  verdict: localizedText,
});

// ---- warbonds -----------------------------------------------------------------------------

export const warbondItemKind = z.enum([
  'weapon',
  'stratagem',
  'booster',
  'armor',
  'helmet',
  'cape',
  'emote',
  'victory-pose',
  'player-card',
  'title',
  'super-credits',
  'other',
]);

export const warbondItemSchema = z.object({
  name: localizedText,
  kind: warbondItemKind,
  /** Catalog id for weapons, stratagems and boosters. */
  ref: id.optional(),
  /** The passive an armor set carries. */
  armorPassive: id.optional(),
  medals: z.number().int().min(0),
});

export const warbondSchema = z.object({
  id,
  name: localizedText,
  /** "free", "premium", "legendary" and so on. */
  type: id,
  /** Price in Super Credits; 0 for free warbonds. */
  superCredits: z.number().int().min(0),
  released: z.iso.date().optional(),
  icon: imageFile.optional(),
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        /** Medals that must be spent in the warbond before this page opens. Null when unknown. */
        medalsToUnlock: z.number().int().min(0).nullable(),
        items: z.array(warbondItemSchema).min(1),
      }),
    )
    .min(1),
});

// ---- weapon customization ------------------------------------------------------------------

export const attachmentSchema = z.object({
  id,
  name,
  slot: id,
  effect: localizedText,
  icon: imageFile.optional(),
});

export const weaponBuildSchema = z.object({
  weapon: id,
  /** Attachments the weapon takes, per slot. */
  available: z.record(id, z.array(id)).default({}),
  /** The setup we recommend, per slot. */
  recommended: z.record(id, id),
  why: localizedText.optional(),
  /** Weapon level and requisition cost of each attachment on this weapon. */
  unlocks: z.record(id, z.object({ level: z.number().int().min(0), requisition: z.number().int().min(0) })).default({}),
});

export const weaponCatalogSchema = documentHeader('weapon-catalog').extend({ weapons: z.array(weaponSchema).min(1) });
export const stratagemCatalogSchema = documentHeader('stratagem-catalog').extend({
  stratagems: z.array(stratagemSchema).min(1),
});
export const perkCatalogSchema = documentHeader('perk-catalog').extend({
  armorPassives: z.array(perkSchema).default([]),
  boosters: z.array(perkSchema).default([]),
});
export const missionCatalogSchema = documentHeader('mission-catalog').extend({
  factions: z.array(factionSchema).min(1),
  missionCategories: z.array(missionCategorySchema).min(1),
  missionTypes: z.array(missionTypeSchema).min(1),
});
export const ratingsSchema = documentHeader('ratings').extend({
  sources: z.array(z.url()).default([]),
  ratings: z.array(ratingSchema).min(1),
});
/** Equipment sold for Super Credits outside warbonds, or handed out as a reward. */
const offerTarget = {
  kind: equipmentKind,
  /** Catalog id; for armor, the passive the set carries. */
  ref: id,
  name: localizedText,
};

export const warbondCatalogSchema = documentHeader('warbond-catalog').extend({
  /** The game's currencies, explained briefly. */
  currencies: z.array(z.object({ id, name, text: localizedText })).default([]),
  warbonds: z.array(warbondSchema).min(1),
  superstore: z.array(z.object({ ...offerTarget, superCredits: z.number().int().positive() })).default([]),
  rewards: z.array(z.object({ ...offerTarget, how: localizedText })).default([]),
});
export const customizationSchema = documentHeader('weapon-customization').extend({
  /** How the system works, in a couple of sentences. */
  system: localizedText,
  slots: z.array(z.object({ id, name })).min(1),
  attachments: z.array(attachmentSchema).min(1),
  weapons: z.array(weaponBuildSchema).default([]),
});
export const combosSchema = documentHeader('combos').extend({
  sources: z.array(z.url()).default([]),
  combos: z.array(comboSchema).min(1),
});
export const loadoutsSchema = documentHeader('loadouts').extend({
  gameVersion: z.string().min(1),
  sources: z.array(z.url()).default([]),
  loadouts: z.array(loadoutSchema).min(1),
});

export type LocalizedText = z.infer<typeof localizedText>;
export type Direction = z.infer<typeof direction>;
export type ArmorPen = z.infer<typeof armorPen>;
export type WeaponCategory = z.infer<typeof weaponCategory>;
export type WeaponTrait = z.infer<typeof weaponTrait>;
export type Weapon = z.infer<typeof weaponSchema>;
export type Stratagem = z.infer<typeof stratagemSchema>;
export type StratagemCategory = z.infer<typeof stratagemCategory>;
export type Perk = z.infer<typeof perkSchema>;
export type Faction = z.infer<typeof factionSchema>;
export type MissionCategory = z.infer<typeof missionCategorySchema>;
export type MissionType = z.infer<typeof missionTypeSchema>;
export type Kit = z.infer<typeof kitSchema>;
export type Loadout = z.infer<typeof loadoutSchema>;
export type Combo = z.infer<typeof comboSchema>;
export type ComboTag = z.infer<typeof comboTag>;
export type ComboFocus = z.infer<typeof comboFocus>;
export type LoadoutRole = z.infer<typeof loadoutRole>;
export type Tier = z.infer<typeof tier>;
export type Popularity = z.infer<typeof popularity>;
export type EquipmentKind = z.infer<typeof equipmentKind>;
export type Rating = z.infer<typeof ratingSchema>;
export type Warbond = z.infer<typeof warbondSchema>;
export type WarbondItem = z.infer<typeof warbondItemSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type WeaponBuild = z.infer<typeof weaponBuildSchema>;

/** Catalog entries are keyed by kind and id, since ids are only unique within one catalog. */
export type EquipmentKey = `${EquipmentKind}:${string}`;
export const equipmentKey = (kind: EquipmentKind, entryId: string): EquipmentKey => `${kind}:${entryId}`;

/** Where a piece of equipment comes from. */
export type Obtain =
  | { via: 'warbond'; warbond: string; page: number; medals: number; medalsToUnlock: number | null }
  | { via: 'requisition'; level: number; requisition: number }
  | { via: 'superstore'; name: LocalizedText; superCredits: number }
  | { via: 'reward'; how: LocalizedText };

/** Validated, cross-checked content handed to the renderer. */
export interface Hd2Content {
  manifest: ContentManifest;
  weapons: Record<string, Weapon>;
  stratagems: Record<string, Stratagem>;
  armorPassives: Record<string, Perk>;
  boosters: Record<string, Perk>;
  factions: Faction[];
  missionCategories: MissionCategory[];
  missionTypes: MissionType[];
  loadouts: Loadout[];
  combos: Combo[];
  /** Community guides the loadouts and ratings were compiled from. */
  sources: string[];
  ratings: Partial<Record<EquipmentKey, Rating>>;
  warbonds: Warbond[];
  currencies: { id: string; name: LocalizedText; text: LocalizedText }[];
  /** Every way to get each piece of equipment. Missing means it is available from the start. */
  obtain: Partial<Record<EquipmentKey, Obtain[]>>;
  customization: {
    system: LocalizedText | null;
    slots: { id: string; name: LocalizedText }[];
    attachments: Record<string, Attachment>;
    builds: Record<string, WeaponBuild>;
  };
}
