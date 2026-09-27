import { z } from 'zod';
import {
  combosSchema,
  itemCatalogSchema,
  itemRatingsSchema,
  manifestSchema,
  survivorBuildsSchema,
  survivorCatalogSchema,
  survivorRatingsSchema,
  type Build,
  type ContentManifest,
  type Ror2Content,
  type SurvivorBuilds,
  CONTENT_SCHEMA_VERSION,
} from './schema';

/**
 * Raw content as delivered by any source: documents keyed by a name used only in error
 * messages (a file path for bundled YAML, a row id for a database). Each document says what
 * it is through its `kind` header.
 */
export type RawContent = Record<string, unknown>;

const rawContentSchema = z.record(z.string(), z.unknown());

function describe(path: string, error: z.ZodError): string {
  return `${path}: ${z.prettifyError(error)}`;
}

/** Graph checks z.object cannot express. Returns human-readable problems. */
export function checkBuild(build: Build, items: Record<string, { tier: string }>): string[] {
  const problems: string[] = [];
  const known = (where: string, id: string) => {
    if (!(id in items)) problems.push(`${build.id}/${where}: unknown item "${id}"`);
  };
  const nodes = new Map(build.nodes.map((node) => [node.id, node]));
  if (nodes.size !== build.nodes.length) problems.push(`${build.id}: duplicate node ids`);
  if (!nodes.has(build.root)) problems.push(`${build.id}: root "${build.root}" is not a node`);

  for (const node of build.nodes) {
    for (const next of node.next) {
      if (!nodes.has(next)) problems.push(`${build.id}/${node.id}: next "${next}" is not a node`);
    }
    for (const item of node.items) known(node.id, item.id);
  }
  for (const avoided of build.avoid) known('avoid', avoided.id);
  for (const [tier, ids] of Object.entries(build.pickOrder)) {
    for (const id of ids ?? []) {
      known(`pickOrder.${tier}`, id);
      const actual = items[id]?.tier;
      if (actual && actual !== tier) problems.push(`${build.id}/pickOrder.${tier}: "${id}" is ${actual}`);
    }
  }
  build.milestones.forEach((milestone, index) => {
    for (const id of [...milestone.take, ...milestone.stop]) known(`milestones[${index}]`, id);
  });

  // Every node reachable from the root, and no cycles.
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === 'done') return;
    if (current === 'visiting') {
      problems.push(`${build.id}: cycle through "${id}"`);
      return;
    }
    state.set(id, 'visiting');
    for (const next of nodes.get(id)?.next ?? []) if (nodes.has(next)) visit(next);
    state.set(id, 'done');
  };
  if (nodes.has(build.root)) visit(build.root);
  for (const id of nodes.keys()) {
    if (!state.has(id)) problems.push(`${build.id}: node "${id}" is not reachable from the root`);
  }
  return problems;
}

/**
 * Validates and merges raw documents. Throws with every problem listed.
 * Documents with a newer schemaVersion than this app supports are rejected, so the core falls
 * back to the next content source (ultimately the bundled content) instead of misreading them.
 */
export function parseContent(raw: unknown): Ror2Content {
  const documents = rawContentSchema.parse(raw);
  const problems: string[] = [];
  const manifests: ContentManifest[] = [];
  const content: Omit<Ror2Content, 'manifest'> = {
    items: {},
    survivors: [],
    builds: {},
    ratings: {},
    survivorRatings: {},
    combos: [],
    ratingSources: [],
  };
  const buildFiles: [string, SurvivorBuilds][] = [];

  const parse = <T>(schema: z.ZodType<T>, name: string, document: unknown): T | null => {
    const result = schema.safeParse(document);
    if (result.success) return result.data;
    problems.push(describe(name, result.error));
    return null;
  };

  for (const [name, document] of Object.entries(documents).sort(([a], [b]) => a.localeCompare(b))) {
    const header = (document ?? {}) as { kind?: unknown; schemaVersion?: unknown };
    if (typeof header.schemaVersion === 'number' && header.schemaVersion > CONTENT_SCHEMA_VERSION) {
      problems.push(
        `${name}: schemaVersion ${header.schemaVersion} needs a newer app (this app reads up to ${CONTENT_SCHEMA_VERSION})`,
      );
      continue;
    }
    switch (header.kind) {
      case 'manifest': {
        const manifest = parse(manifestSchema, name, document);
        if (manifest) manifests.push(manifest);
        break;
      }
      case 'item-catalog': {
        for (const item of parse(itemCatalogSchema, name, document)?.items ?? []) {
          if (content.items[item.id]) problems.push(`${name}: duplicate item "${item.id}"`);
          content.items[item.id] = item;
        }
        break;
      }
      case 'survivor-catalog':
        content.survivors.push(...(parse(survivorCatalogSchema, name, document)?.survivors ?? []));
        break;
      case 'survivor-builds': {
        const file = parse(survivorBuildsSchema, name, document);
        if (file) buildFiles.push([name, file]);
        break;
      }
      case 'item-ratings': {
        const file = parse(itemRatingsSchema, name, document);
        for (const rating of file?.ratings ?? []) {
          if (content.ratings[rating.id]) problems.push(`${name}: duplicate rating "${rating.id}"`);
          content.ratings[rating.id] = rating;
        }
        content.ratingSources.push(...(file?.sources ?? []));
        break;
      }
      case 'item-combos': {
        const file = parse(combosSchema, name, document);
        content.combos.push(...(file?.combos ?? []));
        content.ratingSources.push(...(file?.sources ?? []));
        break;
      }
      case 'survivor-ratings': {
        const file = parse(survivorRatingsSchema, name, document);
        for (const rating of file?.survivors ?? []) {
          if (content.survivorRatings[rating.id]) problems.push(`${name}: duplicate survivor rating "${rating.id}"`);
          content.survivorRatings[rating.id] = rating;
        }
        content.ratingSources.push(...(file?.sources ?? []));
        break;
      }
      default:
        problems.push(`${name}: unknown document kind ${JSON.stringify(header.kind)}`);
    }
  }

  if (manifests.length !== 1) problems.push(`expected exactly one manifest document, found ${manifests.length}`);

  const survivorIds = new Set(content.survivors.map((survivor) => survivor.id));
  // Build ids are stored in user selections, so they must be unique across all survivors.
  const buildIds = new Set<string>();
  for (const [name, file] of buildFiles) {
    if (!survivorIds.has(file.survivor)) problems.push(`${name}: unknown survivor "${file.survivor}"`);
    if (content.builds[file.survivor]) problems.push(`${name}: survivor "${file.survivor}" has two build documents`);
    for (const build of file.builds) {
      if (buildIds.has(build.id)) problems.push(`${name}: duplicate build "${build.id}"`);
      buildIds.add(build.id);
      problems.push(...checkBuild(build, content.items).map((problem) => `${name}: ${problem}`));
    }
    content.builds[file.survivor] = file;
  }

  const equipmentTiers = new Set(['equipment', 'lunar-equipment', 'elite-equipment']);
  const comboIds = new Set<string>();
  for (const combo of content.combos) {
    const where = `combo ${combo.id}`;
    if (comboIds.has(combo.id)) problems.push(`duplicate combo "${combo.id}"`);
    comboIds.add(combo.id);
    for (const { id: itemId } of combo.items) {
      const item = content.items[itemId];
      if (!item) problems.push(`${where}: unknown item "${itemId}"`);
      else if (equipmentTiers.has(item.tier)) problems.push(`${where}: "${itemId}" is equipment, not an item`);
    }
    if (combo.equipment) {
      const equipment = content.items[combo.equipment];
      if (!equipment) problems.push(`${where}: unknown equipment "${combo.equipment}"`);
      else if (!equipmentTiers.has(equipment.tier)) problems.push(`${where}: "${combo.equipment}" is not equipment`);
    }
    for (const itemId of combo.avoid) if (!content.items[itemId]) problems.push(`${where}: unknown item to avoid "${itemId}"`);
    for (const survivor of combo.survivors) if (!survivorIds.has(survivor)) problems.push(`${where}: unknown survivor "${survivor}"`);
  }
  for (const rating of Object.values(content.survivorRatings)) {
    if (!survivorIds.has(rating.id)) problems.push(`survivor rating "${rating.id}": unknown survivor`);
  }
  for (const rating of Object.values(content.ratings)) {
    if (!content.items[rating.id]) problems.push(`rating "${rating.id}": unknown item`);
    for (const survivor of rating.bestFor) {
      if (!survivorIds.has(survivor)) problems.push(`rating "${rating.id}": unknown survivor "${survivor}"`);
    }
  }

  if (problems.length > 0) throw new Error(`Invalid Risk of Rain 2 content:\n- ${problems.join('\n- ')}`);
  return { manifest: manifests[0]!, ...content };
}

/** Every localization token the content refers to. */
export function contentTokens(content: Ror2Content): Set<string> {
  const tokens = new Set<string>();
  for (const item of Object.values(content.items)) {
    tokens.add(item.token);
    if (item.pickup) tokens.add(item.pickup);
    if (item.desc) tokens.add(item.desc);
  }
  for (const survivor of content.survivors) tokens.add(survivor.token);
  for (const file of Object.values(content.builds)) {
    for (const build of file.builds) for (const skill of Object.values(build.loadout)) if (skill) tokens.add(skill);
  }
  return tokens;
}
