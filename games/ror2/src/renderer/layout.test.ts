import { describe, expect, it } from 'vitest';
import type { Build } from '../content/schema';
import { edges, layoutColumns } from './layout';

function build(links: Record<string, string[]>, root = 'a'): Build {
  return {
    id: 'b',
    title: { en: 'b' },
    difficulty: 'beginner',
    summary: { en: 's' },
    loadout: {},
    root,
    nodes: Object.entries(links).map(([id, next]) => ({ id, phase: 'early', items: [{ id: 'x', priority: 'core' }], next })),
    pickOrder: {},
    milestones: [],
    avoid: [],
  };
}

describe('layoutColumns', () => {
  it('puts branches side by side and a shared follow-up after the deepest branch', () => {
    const b = build({ a: ['b', 'c'], b: ['d'], c: ['e'], e: ['d'], d: [] });
    expect(layoutColumns(b)).toEqual([['a'], ['b', 'c'], ['e'], ['d']]);
  });

  it('ignores unreachable nodes and a missing root', () => {
    expect(layoutColumns(build({ a: ['b'], b: [], lonely: [] }))).toEqual([['a'], ['b']]);
    expect(layoutColumns(build({ a: [] }, 'nope'))).toEqual([]);
  });

  it('lists edges', () => {
    expect(edges(build({ a: ['b', 'c'], b: [], c: [] }))).toEqual([
      ['a', 'b'],
      ['a', 'c'],
    ]);
  });
});
