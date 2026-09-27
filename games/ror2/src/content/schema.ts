import { z } from 'zod';
import { documentHeader, idSchema as id, imageFile, localizedText, manifestSchema, type ContentManifest } from '@guide/content-tools';

export { localizedText, manifestSchema };

/** Bump when the document format changes incompatibly; older apps then reject newer content. */
export const CONTENT_SCHEMA_VERSION = 1;

const token = z.string().regex(/^[A-Z0-9_]+$/, 'localization tokens are UPPER_SNAKE_CASE');

export const itemTier = z.enum([
  'common',
  'uncommon',
  'legendary',
  'boss',
  'lunar',
  'void',
  'meal',
  'equipment',
  'lunar-equipment',
  'elite-equipment',
]);

/** base game, Survivors of the Void, Seekers of the Storm, Alloyed Collective */
export const dlc = z.enum(['base', 'sotv', 'sots', 'ac']);

export const itemSchema = z.object({
  /** Internal ItemDef / EquipmentDef name, e.g. "Syringe". */
  id,
  /** Game localization token for the display name, e.g. "ITEM_SYRINGE_NAME". */
  token,
  /** Game localization token for the short effect text, e.g. "ITEM_SYRINGE_PICKUP". */
  pickup: token.optional(),
  /** Game localization token for the full description with per-stack values, e.g. "ITEM_SYRINGE_DESC". */
  desc: token.optional(),
  tier: itemTier,
  dlc: dlc.optional(),
  /** Used when the game's own localization cannot be read. */
  en: z.string().min(1),
  icon: imageFile.optional(),
});

export const survivorSchema = z.object({
  /** Internal body name, e.g. "CommandoBody". */
  id,
  token,
  en: z.string().min(1),
  icon: imageFile.optional(),
});

export const skillSlot = z.enum(['primary', 'secondary', 'utility', 'special']);

/** `loop` covers everything after the first loop, however long the run goes. */
export const phase = z.enum(['early', 'mid', 'late', 'loop']);
export const priority = z.enum(['core', 'optional', 'situational']);

/**
 * How many to collect. `target` is the number shown to players ("×10"); no `max` means more
 * copies keep helping ("×10+"). `min` is the least worth having when it differs from the target.
 */
export const stackTarget = z
  .object({
    target: z.number().int().positive(),
    min: z.number().int().positive().optional(),
    max: z.number().int().positive().optional(),
  })
  .refine((s) => s.min === undefined || s.min <= s.target, 'min must be <= target')
  .refine((s) => s.max === undefined || s.max >= s.target, 'max must be >= target');

export const buildNodeSchema = z.object({
  id,
  phase,
  label: localizedText.optional(),
  /** When to take this branch. */
  when: localizedText.optional(),
  items: z
    .array(
      z.object({
        id,
        priority,
        stacks: stackTarget.optional(),
        /** Why that many, e.g. "10 stacks = 100% crit". */
        stacksReason: localizedText.optional(),
        note: localizedText.optional(),
      }),
    )
    .min(1),
  next: z.array(id).default([]),
});

/** A turning point later in a run: when it happens, what to start and stop taking. */
export const milestoneSchema = z.object({
  when: localizedText,
  advice: localizedText,
  take: z.array(id).default([]),
  stop: z.array(id).default([]),
});

export const buildSchema = z.object({
  id,
  title: localizedText,
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  summary: localizedText,
  /** Skill slot -> localization token of the chosen skill. */
  loadout: z.partialRecord(skillSlot, token),
  root: id,
  nodes: z.array(buildNodeSchema).min(1),
  /** Preferred order when choosing among items of one tier (printers, Artifact of Command, multishops). */
  pickOrder: z.partialRecord(itemTier, z.array(id).min(1).max(10)).default({}),
  /** Ordered turning points for the rest of the run, written as conditions rather than stage numbers. */
  milestones: z.array(milestoneSchema).max(8).default([]),
  avoid: z.array(z.object({ id, reason: localizedText })).default([]),
  /** Which sources back which picks, and where they disagree. */
  evidence: z.string().min(1).optional(),
});

export const sourceQuality = z.enum(['strong', 'mixed', 'thin']);

// ---- documents (headers and the manifest come from @guide/content-tools) --------------

export const itemCatalogSchema = documentHeader('item-catalog').extend({
  items: z.array(itemSchema).min(1),
});

export const survivorCatalogSchema = documentHeader('survivor-catalog').extend({
  survivors: z.array(survivorSchema).min(1),
});

export const survivorBuildsSchema = documentHeader('survivor-builds').extend({
  survivor: id,
  /** Game version the builds were checked against. */
  gameVersion: z.string().min(1),
  /** How well the community sources agree for this survivor. */
  sourceQuality: sourceQuality.optional(),
  sources: z.array(z.url()).default([]),
  builds: z.array(buildSchema).min(1),
});

/** How strong an item is within its rarity (a good green against other greens). */
export const itemRank = z.enum(['S', 'A', 'B', 'C', 'D']);
/** How commonly players take it, separate from how strong it is. */
export const popularity = z.enum(['very-high', 'high', 'medium', 'low', 'rare']);

export const itemRatingSchema = z.object({
  id,
  rank: itemRank,
  popularity: popularity.optional(),
  /** Survivors that especially want it. */
  bestFor: z.array(id).default([]),
  verdict: localizedText,
});

export const itemRatingsSchema = documentHeader('item-ratings').extend({
  gameVersion: z.string().min(1),
  sources: z.array(z.url()).default([]),
  ratings: z.array(itemRatingSchema).min(1),
});

/** How strong a survivor is in a normal run up to looping, played well. */
export const survivorRatingSchema = z.object({
  id,
  rank: itemRank,
  /** How hard it is to play well. */
  difficulty: z.enum(['easy', 'medium', 'hard']),
  popularity: popularity.optional(),
  strengths: localizedText,
  weaknesses: localizedText,
  verdict: localizedText,
});

export const survivorRatingsSchema = documentHeader('survivor-ratings').extend({
  gameVersion: z.string().min(1),
  sources: z.array(z.url()).default([]),
  survivors: z.array(survivorRatingSchema).min(1),
});

/** What a theme combo is built around. */
export const comboFocus = z.enum(['items', 'equipment', 'survivor', 'challenge']);
export const comboTag = z.enum(['theme', 'chaos', 'challenge', 'solo', 'team', 'long-run']);

/** A build picked for fun rather than strength: an item theme, not a survivor's best path. */
export const comboSchema = z.object({
  id,
  focus: comboFocus,
  title: localizedText,
  tagline: localizedText,
  /** How to play it: what to prioritise and when it comes online. */
  summary: localizedText,
  whyFun: localizedText.optional(),
  /** Survivors it suits; empty means anyone. */
  survivors: z.array(id).default([]),
  /** Core items first, each with how many to aim for. */
  items: z
    .array(z.object({ id, target: z.number().int().positive(), note: localizedText.optional() }))
    .min(1),
  equipment: id.optional(),
  /** Items that work against the theme. */
  avoid: z.array(id).default([]),
  tags: z.array(comboTag).default([]),
});

export const combosSchema = documentHeader('item-combos').extend({
  sources: z.array(z.url()).default([]),
  combos: z.array(comboSchema).min(1),
});

export const DOCUMENT_KINDS = [
  'manifest',
  'item-catalog',
  'survivor-catalog',
  'survivor-builds',
  'item-ratings',
  'survivor-ratings',
  'item-combos',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type LocalizedText = z.infer<typeof localizedText>;
export type ItemTier = z.infer<typeof itemTier>;
export type Dlc = z.infer<typeof dlc>;
export type SourceQuality = z.infer<typeof sourceQuality>;
export type Item = z.infer<typeof itemSchema>;
export type Survivor = z.infer<typeof survivorSchema>;
export type SkillSlot = z.infer<typeof skillSlot>;
export type Phase = z.infer<typeof phase>;
export type Priority = z.infer<typeof priority>;
export type BuildNode = z.infer<typeof buildNodeSchema>;
export type StackTarget = z.infer<typeof stackTarget>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Build = z.infer<typeof buildSchema>;
export type SurvivorBuilds = z.infer<typeof survivorBuildsSchema>;
export type ItemRank = z.infer<typeof itemRank>;
export type Popularity = z.infer<typeof popularity>;
export type ItemRating = z.infer<typeof itemRatingSchema>;
export type SurvivorRating = z.infer<typeof survivorRatingSchema>;
export type Combo = z.infer<typeof comboSchema>;
export type ComboFocus = z.infer<typeof comboFocus>;
export type ComboTag = z.infer<typeof comboTag>;
export type { ContentManifest };

/** Validated, cross-checked content handed to the renderer. */
export interface Ror2Content {
  manifest: ContentManifest;
  items: Record<string, Item>;
  survivors: Survivor[];
  /** survivorId -> builds */
  builds: Record<string, SurvivorBuilds>;
  /** itemId -> our rating */
  ratings: Record<string, ItemRating>;
  /** survivorId -> our rating */
  survivorRatings: Record<string, SurvivorRating>;
  /** Theme builds for fun. */
  combos: Combo[];
  /** Tier lists and guides the ratings were compiled from. */
  ratingSources: string[];
}
