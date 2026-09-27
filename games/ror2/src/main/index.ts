import type { GameMainModule, Locale, MainHost } from '@guide/sdk';
import { contentTokens, parseContent } from '../content/parse';
import type { Ror2Content } from '../content/schema';
import { manifest } from '../manifest';
import { Ror2Action, selectionSchema, type Selection } from '../selection';
import type { Ror2State } from '../state';
import { bundledContent } from './bundled';
import { readGameStrings } from './gameStrings';

/** Image source for `icon` file names: the wiki's CDN-cached static image path. */
const IMAGE_BASE_URL = 'https://riskofrain2.wiki.gg/images/';

/** Manual picks rank lowest: log parsing and the companion mod will know better. */
const MANUAL_PRIORITY = 10;
const SELECTION_KEY = 'selection';

function readSelection(host: MainHost): Selection {
  const parsed = selectionSchema.safeParse(host.storage.get(SELECTION_KEY) ?? null);
  return parsed.success ? parsed.data : null;
}

function selectionPatch(selection: Selection): Partial<Ror2State> {
  return { survivor: selection?.survivor, buildId: selection?.buildId };
}

const stringCache = new Map<string, Promise<Record<string, string>>>();

async function contentStrings(content: Ror2Content, locale: Locale, host: MainHost): Promise<Record<string, string>> {
  const installDir = host.installDir();
  if (!installDir) return {};
  const key = `${installDir}|${locale}`;
  let all = stringCache.get(key);
  if (!all) {
    all = readGameStrings(installDir, locale).catch((error: unknown) => {
      host.log.warn('Could not read game localization', { locale, error: String(error) });
      stringCache.delete(key);
      return {};
    });
    stringCache.set(key, all);
  }
  const strings = await all;
  // Only ship the names the content uses; the full files are thousands of entries.
  const used: Record<string, string> = {};
  for (const token of contentTokens(content)) {
    const value = strings[token];
    if (value) used[token] = value;
  }
  return used;
}

export const ror2Main: GameMainModule<Ror2State, Ror2Content> = {
  manifest,
  initialState: () => ({ phase: 'unknown' }),
  stateProviders: () => [
    {
      id: 'manual',
      priority: MANUAL_PRIORITY,
      start(host, emit) {
        const selection = readSelection(host);
        if (selection) emit(selectionPatch(selection));
        return { dispose() {} };
      },
    },
  ],
  content: {
    bundled: bundledContent,
    parse: parseContent,
    strings: contentStrings,
    meta: ({ manifest }) => ({
      version: manifest.version,
      updatedAt: manifest.updatedAt,
      gameVersion: manifest.gameVersion,
    }),
    asset: (content, kind, id) => {
      const file =
        kind === 'item'
          ? content.items[id]?.icon
          : kind === 'survivor'
            ? content.survivors.find((survivor) => survivor.id === id)?.icon
            : undefined;
      return file ? `${IMAGE_BASE_URL}${encodeURIComponent(file)}` : null;
    },
    // Item icons are small originals already, so no thumbnails are needed.
    assets: (content) => [
      ...Object.keys(content.items).map((id) => ({ kind: 'item', id })),
      ...content.survivors.map((survivor) => ({ kind: 'survivor', id: survivor.id })),
    ],
  },
  actions: {
    [Ror2Action.GetSelection]: (_payload, { host }) => readSelection(host),
    [Ror2Action.Select]: (payload, { host, updateState }) => {
      const selection = selectionSchema.parse(payload);
      host.storage.set(SELECTION_KEY, selection);
      updateState(MANUAL_PRIORITY, selectionPatch(selection));
      return selection;
    },
  },
};
