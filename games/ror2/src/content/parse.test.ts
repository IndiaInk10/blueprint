import { describe, expect, it } from 'vitest';
import { bundledContent } from '../main/bundled';
import { checkBuild, contentTokens, parseContent } from './parse';
import type { Build } from './schema';

describe('bundled content', () => {
  // This is the content CI check: every shipped YAML file must validate.
  it('is valid', () => {
    const content = parseContent(bundledContent());
    expect(content.survivors.length).toBeGreaterThan(0);
    for (const survivor of content.survivors) expect(content.builds[survivor.id]?.builds.length).toBeGreaterThan(0);
  });

  it('lists every token it needs', () => {
    const tokens = contentTokens(parseContent(bundledContent()));
    expect(tokens.has('ITEM_SYRINGE_NAME')).toBe(true);
    expect(tokens.has('COMMANDO_BODY_NAME')).toBe(true);
    expect(tokens.has('COMMANDO_PRIMARY_NAME')).toBe(true);
  });
});

describe('checkBuild', () => {
  const items = { A: { tier: 'common' }, B: { tier: 'uncommon' } };
  const build = (nodes: Build['nodes'], root = 'n1'): Build => ({
    id: 'b',
    title: { en: 'b' },
    difficulty: 'beginner',
    summary: { en: 's' },
    loadout: {},
    root,
    nodes,
    pickOrder: {},
    milestones: [],
    avoid: [],
  });
  const node = (id: string, next: string[] = [], item = 'A'): Build['nodes'][number] => ({
    id,
    phase: 'early',
    items: [{ id: item, priority: 'core' }],
    next,
  });

  it('accepts a branching DAG', () => {
    expect(checkBuild(build([node('n1', ['n2', 'n3']), node('n2', ['n4']), node('n3', ['n4']), node('n4')]), items)).toEqual(
      [],
    );
  });

  it('reports cycles, unreachable nodes, dangling links and unknown items', () => {
    const problems = checkBuild(
      build([node('n1', ['n2']), node('n2', ['n1', 'ghost']), node('lonely'), node('n3', [], 'Z')]),
      items,
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        'b/n2: next "ghost" is not a node',
        'b/n3: unknown item "Z"',
        'b: cycle through "n1"',
        'b: node "lonely" is not reachable from the root',
      ]),
    );
  });

  it('reports a missing root', () => {
    expect(checkBuild(build([node('n1')], 'nope'), items)).toContain('b: root "nope" is not a node');
  });
});

describe('parseContent', () => {
  const header = { schemaVersion: 1, revision: 1, updatedAt: '2026-09-26' };
  const manifest = { kind: 'manifest', schemaVersion: 1, version: '2026.09.26.1', gameVersion: 'v1', updatedAt: '2026-09-26' };
  const items = { kind: 'item-catalog', ...header, items: [{ id: 'A', token: 'ITEM_A_NAME', tier: 'common', en: 'A' }] };
  const survivors = { kind: 'survivor-catalog', ...header, survivors: [{ id: 'S', token: 'S_BODY_NAME', en: 'S' }] };
  const builds = (survivor: string, buildId: string, item = 'A') => ({
    kind: 'survivor-builds',
    ...header,
    survivor,
    gameVersion: 'v1',
    builds: [
      {
        id: buildId,
        title: { en: 'b' },
        difficulty: 'beginner',
        summary: { en: 's' },
        loadout: {},
        root: 'n1',
        nodes: [{ id: 'n1', phase: 'early', items: [{ id: item, priority: 'core' }] }],
      },
    ],
  });

  it('identifies documents by kind, not by name', () => {
    const content = parseContent({ one: manifest, two: items, three: survivors, four: builds('S', 'b1') });
    expect(content.manifest.version).toBe('2026.09.26.1');
    expect(content.builds['S']?.builds[0]?.id).toBe('b1');
  });

  it('lists every problem at once', () => {
    expect(() => parseContent({ manifest, items, survivors, x: builds('Nobody', 'b', 'Missing') })).toThrow(
      /unknown survivor "Nobody"[\s\S]*unknown item "Missing"/,
    );
  });

  it('requires exactly one manifest and known kinds', () => {
    expect(() => parseContent({ items, survivors })).toThrow(/exactly one manifest/);
    expect(() => parseContent({ manifest, items, survivors, odd: { kind: 'recipe' } })).toThrow(/unknown document kind "recipe"/);
  });

  it('rejects content written for a newer app', () => {
    expect(() => parseContent({ manifest, items: { ...items, schemaVersion: 2 }, survivors })).toThrow(
      /schemaVersion 2 needs a newer app/,
    );
  });

  it('keeps build ids unique across survivors', () => {
    const second = { kind: 'survivor-catalog', ...header, survivors: [{ id: 'T', token: 'T_BODY_NAME', en: 'T' }] };
    expect(() => parseContent({ manifest, items, survivors, second, a: builds('S', 'same'), b: builds('T', 'same') })).toThrow(
      /duplicate build "same"/,
    );
  });

  it('checks theme builds against the catalogs', () => {
    const withEquipment = {
      ...items,
      items: [...items.items, { id: 'Gun', token: 'EQUIPMENT_GUN_NAME', tier: 'equipment', en: 'Gun' }],
    };
    const combo = (patch: Record<string, unknown>) => ({
      kind: 'item-combos',
      ...header,
      combos: [
        { id: 'c', focus: 'items', title: { en: 't' }, tagline: { en: 't' }, summary: { en: 's' }, items: [{ id: 'A', target: 3 }], ...patch },
      ],
    });
    expect(() => parseContent({ manifest, items: withEquipment, survivors, combos: combo({ equipment: 'Gun' }) })).not.toThrow();
    expect(() =>
      parseContent({ manifest, items: withEquipment, survivors, combos: combo({ items: [{ id: 'Gun', target: 1 }], equipment: 'A', survivors: ['Nobody'] }) }),
    ).toThrow(/"Gun" is equipment, not an item[\s\S]*"A" is not equipment[\s\S]*unknown survivor "Nobody"/);
  });
});
