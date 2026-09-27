import { describe, expect, it } from 'vitest';
import { isAvailable, ownedSet, recommendWarbonds } from './recommend';
import { equipmentKey, type Hd2Content, type Loadout, type Rating, type Warbond } from './schema';

const name = (en: string) => ({ en });
const weapon = (id: string, slot: 'primary' | 'secondary' | 'throwable') => ({ id, name: name(id), slot, category: 'special' as const, traits: [] });
const stratagem = (id: string) => ({ id, name: name(id), category: 'orbital' as const, code: ['up' as const] });
const perk = (id: string) => ({ id, name: name(id), effect: name('e') });

const warbond = (id: string, superCredits: number, items: Warbond['pages'][number]['items'], medalsToUnlock: number | null = 0): Warbond => ({
  id,
  name: name(id),
  type: superCredits ? 'premium' : 'free',
  superCredits,
  pages: [{ page: 1, medalsToUnlock: 0, items: [] }, { page: 2, medalsToUnlock, items }].filter((p) => p.items.length > 0 || p.page === 2),
});

const loadout = (id: string, primary: string, roles: Loadout['roles'], faction = 'bugs'): Loadout => ({
  id,
  title: name(id),
  faction,
  missionTypes: ['m'],
  difficulty: { min: 1, max: 10 },
  primary,
  secondary: 'pistol',
  throwable: 'grenade',
  stratagems: ['a', 'b', 'c', 'd'],
  armorPassive: 'armor',
  summary: name('s'),
  slotNotes: {},
  roles,
});

const rated = (id: string): Rating => ({ kind: 'weapon', id, overall: 'A', factions: {}, verdict: name('v') });

function content(): Hd2Content {
  const warbonds = [
    warbond('free', 0, [{ name: name('Rifle'), kind: 'weapon', ref: 'rifle', medals: 5 }]),
    warbond('fire', 1000, [{ name: name('Flamer'), kind: 'weapon', ref: 'flamer', medals: 20 }], 60),
    warbond('laser', 1000, [{ name: name('Laser'), kind: 'weapon', ref: 'laser', medals: 30 }], null),
    warbond('pricey', 1500, [{ name: name('Laser2'), kind: 'weapon', ref: 'laser2', medals: 30 }]),
  ];
  const c: Hd2Content = {
    manifest: { kind: 'manifest', schemaVersion: 1, version: '2026.09.26.1', gameVersion: 'v', updatedAt: '2026-09-26' },
    weapons: Object.fromEntries(
      [weapon('rifle', 'primary'), weapon('flamer', 'primary'), weapon('laser', 'primary'), weapon('laser2', 'primary'), weapon('pistol', 'secondary'), weapon('grenade', 'throwable')].map((w) => [w.id, w]),
    ),
    stratagems: Object.fromEntries(['a', 'b', 'c', 'd'].map((s) => [s, stratagem(s)])),
    armorPassives: { armor: perk('armor') },
    boosters: {},
    factions: [{ id: 'bugs', name: name('Bugs'), priorities: [] }],
    missionCategories: [],
    missionTypes: [],
    loadouts: [loadout('burn', 'flamer', ['crowd-control']), loadout('zap', 'laser', ['anti-tank'])],
    combos: [],
    sources: [],
    ratings: {
      [equipmentKey('weapon', 'flamer')]: rated('flamer'),
      [equipmentKey('weapon', 'laser')]: rated('laser'),
      [equipmentKey('weapon', 'laser2')]: rated('laser2'),
    },
    warbonds,
    currencies: [],
    obtain: {},
    customization: { system: null, slots: [], attachments: {}, builds: {} },
  };
  for (const w of warbonds) {
    for (const page of w.pages) {
      for (const item of page.items) {
        (c.obtain[equipmentKey('weapon', item.ref!)] ??= []).push({
          via: 'warbond',
          warbond: w.id,
          page: page.page,
          medals: item.medals,
          medalsToUnlock: page.medalsToUnlock,
        });
      }
    }
  }
  return c;
}

describe('recommendWarbonds', () => {
  it('treats free warbonds and unsold gear as owned', () => {
    const c = content();
    const owned = ownedSet(c, []);
    expect(isAvailable(c, owned, equipmentKey('weapon', 'rifle'))).toBe(true);
    expect(isAvailable(c, owned, equipmentKey('weapon', 'pistol'))).toBe(true);
    expect(isAvailable(c, owned, equipmentKey('weapon', 'flamer'))).toBe(false);
  });

  it('puts the warbond for the chosen playstyle first and names the loadout it completes', () => {
    const picks = recommendWarbonds(content(), [], { playstyle: 'anti-tank', faction: null });
    expect(picks[0]?.warbond.id).toBe('laser');
    expect(picks[0]?.completes.map((l) => l.id)).toEqual(['zap']);
    expect(picks.map((p) => p.warbond.id)).not.toContain('free');

    const other = recommendWarbonds(content(), [], { playstyle: 'crowd-control', faction: null });
    expect(other[0]?.warbond.id).toBe('fire');
    expect(other[0]?.medals).toEqual({ total: 80, approximate: false });
  });

  it('skips owned warbonds, weighs price, and flags unknown page costs', () => {
    const picks = recommendWarbonds(content(), ['fire'], { playstyle: null, faction: null });
    expect(picks.map((p) => p.warbond.id)).toEqual(['laser', 'pricey']);
    expect(picks[0]?.medals.approximate).toBe(true);
    expect(picks[1]!.value).toBeLessThan(picks[0]!.value);
  });
});
