// Stamps a game's content documents after an edit:
//   - a document whose content hash changed gets revision + 1 and updatedAt = today
//   - if anything changed, manifest.yaml gets the next release version (YYYY.MM.DD.N)
// Usage: node stamp.ts <contentDir> [--check] [--schema-version=N]
//   --check only reports (for CI). CONTENT_DATE=YYYY-MM-DD overrides today's date.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { contentHash, LOCK_FILE, nextContentVersion, type ContentLock } from './versioning.ts';

const args = process.argv.slice(2);
const dirArg = args.find((arg) => !arg.startsWith('--'));
if (!dirArg) {
  console.error('Usage: node stamp.ts <contentDir> [--check] [--schema-version=N]');
  process.exit(2);
}
const contentDir = resolve(dirArg);
const CONTENT_SCHEMA_VERSION = Number(args.find((arg) => arg.startsWith('--schema-version='))?.split('=')[1] ?? 1);
const lockPath = join(contentDir, LOCK_FILE);
const check = args.includes('--check');
const today = process.env['CONTENT_DATE'] ?? new Date().toLocaleDateString('sv-SE');
const MANIFEST = 'manifest.yaml';

function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return yamlFiles(path);
    return entry.name.endsWith('.yaml') ? [path] : [];
  });
}

const previous: ContentLock = existsSync(lockPath)
  ? (JSON.parse(readFileSync(lockPath, 'utf8')) as ContentLock)
  : { version: undefined, documents: {} };
const next: ContentLock = { version: previous.version, documents: {} };
const changes: string[] = [];
const writes: [string, string][] = [];

for (const file of yamlFiles(contentDir).sort()) {
  const name = relative(contentDir, file).replaceAll('\\', '/');
  if (name === MANIFEST) continue;
  const document = parseDocument(readFileSync(file, 'utf8'));
  const data = document.toJS() as Record<string, unknown>;
  if (typeof data['kind'] !== 'string') throw new Error(`${name}: missing "kind" header`);

  const hash = contentHash(data);
  const locked = previous.documents[name];
  const changed = !locked || locked.hash !== hash;
  const revision = changed ? (locked?.revision ?? 0) + 1 : locked.revision;
  next.documents[name] = { revision, hash };
  if (changed) changes.push(`${name}: revision ${locked?.revision ?? '-'} -> ${revision}`);

  const updatedAt = changed ? today : String(data['updatedAt'] ?? today);
  if (data['schemaVersion'] !== CONTENT_SCHEMA_VERSION || data['revision'] !== revision || data['updatedAt'] !== updatedAt) {
    document.set('schemaVersion', data['schemaVersion'] ?? CONTENT_SCHEMA_VERSION);
    document.set('revision', revision);
    document.set('updatedAt', updatedAt);
    writes.push([file, document.toString({ lineWidth: 0 })]);
  }
}

for (const name of Object.keys(previous.documents)) {
  if (!next.documents[name] && name !== MANIFEST) changes.push(`${name}: removed`);
}

// The manifest tracks its own fields (e.g. gameVersion) too, excluding the ones this script writes.
const manifestFile = join(contentDir, MANIFEST);
const manifest = parseDocument(readFileSync(manifestFile, 'utf8'));
const manifestData = manifest.toJS() as Record<string, unknown>;
const manifestHash = contentHash({ ...manifestData, version: undefined });
if (previous.documents[MANIFEST]?.hash !== manifestHash) changes.push(`${MANIFEST}: changed`);
next.documents[MANIFEST] = { revision: 1, hash: manifestHash };

if (changes.length > 0) {
  next.version = nextContentVersion(previous.version, today);
  manifest.set('version', next.version);
  manifest.set('updatedAt', today);
  writes.push([manifestFile, manifest.toString({ lineWidth: 0 })]);
} else if (manifestData['version'] !== previous.version) {
  manifest.set('version', previous.version);
  writes.push([manifestFile, manifest.toString({ lineWidth: 0 })]);
}

if (check) {
  if (changes.length > 0 || writes.length > 0) {
    console.error(`Content is not stamped. Run: pnpm --filter @guide/game-ror2 content:stamp\n- ${changes.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Content is stamped (version ${previous.version}).`);
} else {
  for (const [file, text] of writes) writeFileSync(file, text);
  writeFileSync(lockPath, JSON.stringify(next, null, 2) + '\n');
  console.log(changes.length > 0 ? `Content ${next.version}\n- ${changes.join('\n- ')}` : 'No content changes.');
}
