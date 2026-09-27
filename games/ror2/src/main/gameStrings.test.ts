import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentTokens, parseContent } from '../content/parse';
import { bundledContent } from './bundled';
import { parseLenientJson, readGameStrings } from './gameStrings';

describe('parseLenientJson', () => {
  it('drops trailing commas but keeps commas inside strings', () => {
    const text = '﻿{ "strings": { "A": "x, }", "B": "y\\", ]", }, "list": [1, 2, ], }';
    expect(parseLenientJson(text)).toEqual({ strings: { A: 'x, }', B: 'y", ]' }, list: [1, 2] });
  });
});

// Runs only where the game is installed: ROR2_INSTALL_DIR=<path to Risk of Rain 2> pnpm test
const installDir = process.env['ROR2_INSTALL_DIR'];

describe.skipIf(!installDir || !existsSync(installDir))('against the installed game', () => {
  it.each(['ko', 'en'] as const)('resolves every content token in %s', async (locale) => {
    const strings = await readGameStrings(installDir!, locale);
    const missing = [...contentTokens(parseContent(bundledContent()))].filter((token) => !strings[token]);
    expect(missing).toEqual([]);
  });
});
