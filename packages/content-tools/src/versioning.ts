// Content versioning shared by every game's stamp step (run with plain Node) and their tests.
// Keep this file free of imports other than node builtins so Node can run it directly.
import { createHash } from 'node:crypto';

/** Header fields every content document carries. They are excluded from the content hash. */
export const HEADER_KEYS = ['kind', 'schemaVersion', 'revision', 'updatedAt'] as const;

export const LOCK_FILE = 'content.lock.json';

export interface LockEntry {
  revision: number;
  hash: string;
}

export interface ContentLock {
  /** Last stamped content release, mirrored in manifest.yaml. */
  version: string | undefined;
  /** Document name (path under content/) -> stamped state. */
  documents: Record<string, LockEntry>;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** Hash of a document's content, ignoring its header and key order. */
export function contentHash(document: unknown): string {
  const body =
    document && typeof document === 'object' && !Array.isArray(document)
      ? Object.fromEntries(
          Object.entries(document).filter(([key]) => !(HEADER_KEYS as readonly string[]).includes(key)),
        )
      : document;
  return createHash('sha256').update(JSON.stringify(stable(body))).digest('hex').slice(0, 16);
}

/** Next content release, e.g. 2026.09.26.1 -> 2026.09.26.2 on the same day, or a new day's .1. */
export function nextContentVersion(previous: string | undefined, today: string): string {
  const prefix = today.replaceAll('-', '.');
  const match = previous?.match(/^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/);
  return match && match[1] === prefix ? `${prefix}.${Number(match[2]) + 1}` : `${prefix}.1`;
}
