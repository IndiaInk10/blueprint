import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../main/bundled';
import { contentHash, LOCK_FILE, type ContentLock } from '@guide/content-tools/versioning';

// Fails when content was edited without running `pnpm --filter @guide/game-ror2 content:stamp`.
describe('bundled content is stamped', () => {
  const lock = JSON.parse(readFileSync(new URL(`../../content/${LOCK_FILE}`, import.meta.url), 'utf8')) as ContentLock;
  const documents = bundledContent() as Record<string, Record<string, unknown>>;

  it.each(Object.keys(documents).filter((name) => name !== 'manifest.yaml'))('%s', (name) => {
    const document = documents[name]!;
    const locked = lock.documents[name];
    expect(locked, 'document missing from the lock file').toBeDefined();
    expect(contentHash(document), 'content changed without a new revision').toBe(locked!.hash);
    expect(document['revision']).toBe(locked!.revision);
  });

  it('manifest carries the stamped version', () => {
    expect(documents['manifest.yaml']?.['version']).toBe(lock.version);
  });
});
