import { describe, expect, it } from 'vitest';
import { schemaVersionProblem } from './schema';
import { contentHash, nextContentVersion } from './versioning';

describe('nextContentVersion', () => {
  it('counts releases within a day and restarts on a new day', () => {
    expect(nextContentVersion(undefined, '2026-09-26')).toBe('2026.09.26.1');
    expect(nextContentVersion('2026.09.26.1', '2026-09-26')).toBe('2026.09.26.2');
    expect(nextContentVersion('2026.09.26.9', '2026-09-26')).toBe('2026.09.26.10');
    expect(nextContentVersion('2026.09.26.3', '2026-09-27')).toBe('2026.09.27.1');
  });
});

describe('contentHash', () => {
  it('ignores header fields and key order', () => {
    const a = { kind: 'x', revision: 1, updatedAt: '2026-01-01', body: { b: 1, a: [1, 2] } };
    const b = { body: { a: [1, 2], b: 1 }, kind: 'x', revision: 7, updatedAt: '2026-09-26' };
    expect(contentHash(a)).toBe(contentHash(b));
    expect(contentHash(a)).not.toBe(contentHash({ ...a, body: { b: 2, a: [1, 2] } }));
  });
});

describe('schemaVersionProblem', () => {
  it('rejects documents written for a newer app', () => {
    expect(schemaVersionProblem('a.yaml', { schemaVersion: 2 }, 1)).toMatch(/needs a newer app/);
    expect(schemaVersionProblem('a.yaml', { schemaVersion: 1 }, 1)).toBeNull();
    expect(schemaVersionProblem('a.yaml', null, 1)).toBeNull();
  });
});
