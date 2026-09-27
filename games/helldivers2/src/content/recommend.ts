// Which warbond to buy next, given what the player owns and how they like to play.
import {
  equipmentKey,
  type EquipmentKey,
  type EquipmentKind,
  type Hd2Content,
  type Kit,
  type Loadout,
  type LoadoutRole,
  type Tier,
  type Warbond,
} from './schema';

export interface Preferences {
  playstyle: LoadoutRole | null;
  /** Enemy faction the player mostly fights; null for all. */
  faction: string | null;
}

/** A piece of equipment a warbond would add. */
export interface Gain {
  kind: EquipmentKind;
  id: string;
  tier: Tier | null;
  page: number;
  medals: number;
  medalsToUnlock: number | null;
  /** Used by a loadout that matches the player's preferences. */
  fits: boolean;
}

export interface WarbondPick {
  warbond: Warbond;
  score: number;
  /** Score per 1,000 Super Credits, the ranking key. */
  value: number;
  gains: Gain[];
  /** Loadouts this warbond completes, matching the preferences first. */
  completes: Loadout[];
  /** Medals to unlock the gains worth having: those rated S/A or used by a matching loadout. */
  medals: { total: number; approximate: boolean };
}

const TIER_VALUE: Record<Tier, number> = { S: 10, A: 6, B: 3, C: 1, D: 0 };
/** Unrated equipment counts as middling rather than worthless. */
const UNRATED_VALUE = 2;
const FIT_BONUS = 1.5;
const MATCHING_LOADOUT_VALUE = 8;
const OTHER_LOADOUT_VALUE = 2;

/** Warbonds that are always owned. */
export function isFree(warbond: Warbond): boolean {
  return warbond.superCredits === 0;
}

/** Owned warbond ids including the free ones. */
export function ownedSet(content: Hd2Content, owned: readonly string[]): Set<string> {
  return new Set([...owned, ...content.warbonds.filter(isFree).map((w) => w.id)]);
}

/**
 * Whether the player can bring this equipment. Anything not sold anywhere (starter gear, mission
 * stratagems) is available; requisition stratagems only need levels, and campaign rewards are
 * assumed collected, since the app cannot tell and they cannot be bought.
 */
export function isAvailable(content: Hd2Content, owned: Set<string>, key: EquipmentKey): boolean {
  const sources = content.obtain[key];
  if (!sources || sources.length === 0) return true;
  return sources.some(
    (source) => source.via === 'requisition' || source.via === 'reward' || (source.via === 'warbond' && owned.has(source.warbond)),
  );
}

/** Every catalog entry a kit needs. */
export function loadoutKeys(loadout: Kit): EquipmentKey[] {
  return [
    equipmentKey('weapon', loadout.primary),
    equipmentKey('weapon', loadout.secondary),
    equipmentKey('weapon', loadout.throwable),
    ...loadout.stratagems.map((s) => equipmentKey('stratagem', s)),
    equipmentKey('armor', loadout.armorPassive),
    ...(loadout.booster ? [equipmentKey('booster', loadout.booster)] : []),
  ];
}

export function missingFor(content: Hd2Content, owned: Set<string>, loadout: Kit): EquipmentKey[] {
  return loadoutKeys(loadout).filter((key) => !isAvailable(content, owned, key));
}

export function matchesPreferences(loadout: Loadout, preferences: Preferences): boolean {
  return (
    (!preferences.playstyle || loadout.roles.includes(preferences.playstyle)) &&
    (!preferences.faction || loadout.faction === preferences.faction)
  );
}

export function tierFor(content: Hd2Content, key: EquipmentKey, faction: string | null): Tier | null {
  const rating = content.ratings[key];
  if (!rating) return null;
  return (faction && rating.factions[faction]) || rating.overall;
}

function warbondGains(content: Hd2Content, owned: Set<string>, warbond: Warbond, preferences: Preferences): Gain[] {
  const fitting = new Set(
    content.loadouts.filter((l) => matchesPreferences(l, preferences)).flatMap((l) => loadoutKeys(l)),
  );
  const gains = new Map<EquipmentKey, Gain>();
  for (const page of warbond.pages) {
    for (const item of page.items) {
      const targets: [EquipmentKind, string][] = [];
      if ((item.kind === 'weapon' || item.kind === 'stratagem' || item.kind === 'booster') && item.ref) targets.push([item.kind, item.ref]);
      if (item.armorPassive) targets.push(['armor', item.armorPassive]);
      for (const [kind, id] of targets) {
        const key = equipmentKey(kind, id);
        // An armor passive can come with several sets; count the first, cheapest way to it once.
        if (gains.has(key) || isAvailable(content, owned, key)) continue;
        gains.set(key, {
          kind,
          id,
          tier: tierFor(content, key, preferences.faction),
          page: page.page,
          medals: item.medals,
          medalsToUnlock: page.medalsToUnlock,
          fits: fitting.has(key),
        });
      }
    }
  }
  return [...gains.values()];
}

function medalsFor(gains: Gain[]): WarbondPick['medals'] {
  const wanted = gains.filter((g) => g.fits || g.tier === 'S' || g.tier === 'A');
  const approximate = wanted.some((g) => g.medalsToUnlock === null);
  const spent = wanted.reduce((sum, g) => sum + g.medals, 0);
  // Pages open once enough medals are spent in the warbond, so the deepest item sets a floor.
  const deepest = Math.max(0, ...wanted.map((g) => (g.medalsToUnlock ?? 0) + g.medals));
  return { total: Math.max(spent, deepest), approximate };
}

/** Warbonds the player does not own, best value first. */
export function recommendWarbonds(content: Hd2Content, ownedIds: readonly string[], preferences: Preferences): WarbondPick[] {
  const owned = ownedSet(content, ownedIds);
  const incomplete = content.loadouts.filter((l) => missingFor(content, owned, l).length > 0);

  const picks = content.warbonds
    .filter((warbond) => !owned.has(warbond.id))
    .map((warbond): WarbondPick => {
      const gains = warbondGains(content, owned, warbond, preferences);
      const withIt = new Set([...owned, warbond.id]);
      const completes = incomplete
        .filter((l) => missingFor(content, withIt, l).length === 0)
        .sort((a, b) => Number(matchesPreferences(b, preferences)) - Number(matchesPreferences(a, preferences)));
      const score =
        gains.reduce((sum, g) => sum + (g.tier ? TIER_VALUE[g.tier] : UNRATED_VALUE) * (g.fits ? FIT_BONUS : 1), 0) +
        completes.reduce((sum, l) => sum + (matchesPreferences(l, preferences) ? MATCHING_LOADOUT_VALUE : OTHER_LOADOUT_VALUE), 0);
      return {
        warbond,
        score,
        value: score / Math.max(1, warbond.superCredits / 1000),
        gains: gains.sort((a, b) => gainRank(b) - gainRank(a)),
        completes,
        medals: medalsFor(gains),
      };
    });
  return picks.sort((a, b) => b.value - a.value || a.warbond.id.localeCompare(b.warbond.id));
}

function gainRank(gain: Gain): number {
  return (gain.tier ? TIER_VALUE[gain.tier] : UNRATED_VALUE) * (gain.fits ? FIT_BONUS : 1);
}
