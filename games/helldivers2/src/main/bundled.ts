/// <reference types="vite/client" />
import { parse } from 'yaml';
import type { RawContent } from '../content/parse';

// Every YAML file under content/ ships with the app; adding a loadout file needs no code change.
const files = import.meta.glob<string>('../../content/**/*.yaml', { query: '?raw', import: 'default', eager: true });

const PREFIX = '../../content/';

export function bundledContent(): RawContent {
  return Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path.slice(PREFIX.length), parse(text) as unknown]),
  );
}
