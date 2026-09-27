import { describe, expect, it } from 'vitest';
import { bundledContent } from '../main/bundled';
import { parseContent } from './parse';

describe('bundled content', () => {
  // This is the content CI check: every shipped YAML file must validate.
  it('is valid and every faction has loadouts', () => {
    const content = parseContent(bundledContent());
    expect(content.factions.length).toBeGreaterThan(0);
    for (const faction of content.factions) {
      expect(content.loadouts.some((l) => l.faction === faction.id), faction.id).toBe(true);
    }
  });

  it('includes the stratagems the overlay always shows', () => {
    const content = parseContent(bundledContent());
    expect(content.stratagems['reinforce']?.category).toBe('mission');
    expect(content.stratagems['resupply']?.category).toBe('mission');
  });

  it('keeps stratagem codes unique', () => {
    const content = parseContent(bundledContent());
    const seen = new Map<string, string>();
    for (const s of Object.values(content.stratagems)) {
      const code = s.code.join(' ');
      expect(seen.get(code), `${s.id} shares its code`).toBeUndefined();
      seen.set(code, s.id);
    }
  });
});

describe('parseContent', () => {
  const header = { schemaVersion: 1, revision: 1, updatedAt: '2026-09-26' };
  const manifest = { kind: 'manifest', schemaVersion: 1, version: '2026.09.26.1', gameVersion: 'v1', updatedAt: '2026-09-26' };
  const weapons = {
    kind: 'weapon-catalog',
    ...header,
    weapons: [
      { id: 'rifle', name: { en: 'Rifle' }, slot: 'primary', category: 'assault-rifle' },
      { id: 'pistol', name: { en: 'Pistol' }, slot: 'secondary', category: 'pistol' },
      { id: 'grenade', name: { en: 'Grenade' }, slot: 'throwable', category: 'standard' },
    ],
  };
  const stratagem = (id: string, code: string[], category = 'orbital') => ({ id, name: { en: id }, category, code });
  const stratagems = {
    kind: 'stratagem-catalog',
    ...header,
    stratagems: [
      stratagem('a', ['up']),
      stratagem('b', ['down']),
      stratagem('c', ['left']),
      stratagem('d', ['right']),
      stratagem('reinforce', ['up', 'down'], 'mission'),
    ],
  };
  const perks = { kind: 'perk-catalog', ...header, armorPassives: [{ id: 'armor', name: { en: 'A' }, effect: { en: 'e' } }] };
  const missions = {
    kind: 'mission-catalog',
    ...header,
    factions: [{ id: 'bugs', name: { en: 'Bugs' } }],
    missionCategories: [{ id: 'kill', name: { en: 'Kill' }, demands: { en: 'd' } }],
    missionTypes: [{ id: 'eradicate', name: { en: 'Eradicate' }, category: 'kill', factions: ['bugs'], demands: { en: 'd' } }],
  };
  const loadouts = (patch: Record<string, unknown> = {}) => ({
    kind: 'loadouts',
    ...header,
    gameVersion: 'v1',
    loadouts: [
      {
        id: 'l',
        title: { en: 'L' },
        faction: 'bugs',
        missionTypes: ['eradicate'],
        difficulty: { min: 7, max: 10 },
        primary: 'rifle',
        secondary: 'pistol',
        throwable: 'grenade',
        stratagems: ['a', 'b', 'c', 'd'],
        armorPassive: 'armor',
        summary: { en: 's' },
        ...patch,
      },
    ],
  });

  it('accepts a consistent set of documents', () => {
    const content = parseContent({ manifest, weapons, stratagems, perks, missions, loadouts: loadouts() });
    expect(content.loadouts[0]?.slotNotes).toEqual({});
  });

  it('checks slots, stratagems and missions against the catalogs', () => {
    expect(() =>
      parseContent({
        manifest,
        weapons,
        stratagems,
        perks,
        missions,
        loadouts: loadouts({ primary: 'pistol', stratagems: ['a', 'b', 'c', 'reinforce'], missionTypes: ['blitz'] }),
      }),
    ).toThrow(/"pistol" is a secondary[\s\S]*"reinforce" is a mission stratagem[\s\S]*unknown mission type "blitz"/);
  });

  it('rejects content written for a newer app', () => {
    expect(() =>
      parseContent({ manifest, weapons: { ...weapons, schemaVersion: 2 }, stratagems, perks, missions, loadouts: loadouts() }),
    ).toThrow(/schemaVersion 2 needs a newer app/);
  });
});
