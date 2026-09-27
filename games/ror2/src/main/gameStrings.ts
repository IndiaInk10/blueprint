import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locale } from '@guide/sdk';

const LANGUAGE_DIRS: Record<Locale, string> = { ko: 'ko', en: 'en' };

/**
 * The game's language files are almost JSON: some end objects with a trailing comma.
 * Drops commas that directly precede "}" or "]", leaving string contents untouched.
 */
export function parseLenientJson(text: string): unknown {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += ch;
  }
  return JSON.parse(out.replace(/^﻿/, ''));
}

/** Strips Unity rich-text tags such as <color=#fff>. */
function plain(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/** Full descriptions keep their <style=...> markup; the renderer colours it like the game does. */
const KEEPS_MARKUP = /_DESC$/;

/** All strings of one locale from the local install. Files that fail to parse are skipped. */
export async function readGameStrings(installDir: string, locale: Locale): Promise<Record<string, string>> {
  const dir = join(installDir, 'Risk of Rain 2_Data', 'StreamingAssets', 'Language', LANGUAGE_DIRS[locale]);
  const strings: Record<string, string> = {};
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json')).sort()) {
    try {
      const parsed = parseLenientJson(await readFile(join(dir, file), 'utf8')) as { strings?: Record<string, unknown> };
      for (const [token, value] of Object.entries(parsed.strings ?? {})) {
        if (typeof value === 'string') strings[token] = KEEPS_MARKUP.test(token) ? value : plain(value);
      }
    } catch {
      // A broken file only costs us the names it contains; fallbacks cover them.
    }
  }
  return strings;
}
