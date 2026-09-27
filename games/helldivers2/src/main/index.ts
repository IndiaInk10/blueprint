import { mediaWikiImage, type AssetRef, type GameMainModule, type MainHost } from '@guide/sdk';
import { parseContent } from '../content/parse';
import type { Hd2Content } from '../content/schema';
import { manifest } from '../manifest';
import { Hd2Action, profileSchema, selectionSchema, type Profile, type Selection } from '../selection';
import type { Hd2State } from '../state';
import { bundledContent } from './bundled';
import { applyLightingFix, graphicsStatus, restoreBackup } from './graphics';
import { CORNER, PhaseTracker, phaseFromCorner } from './phase';

/** Image source for `icon` file names: the Helldivers 2 wiki's static image path. */
const IMAGE_BASE_URL = 'https://helldivers.wiki.gg/images/';
/** Weapon renders are 4K originals; tiles show them at most ~112px wide, so 240px covers 2x screens. */
const IMAGE_WIDTH = 240;

const MANUAL_PRIORITY = 10;
const SCREEN_PRIORITY = 20;
/** How often the screen is checked while the game is in front. */
const SCREEN_INTERVAL_MS = 2000;
const SELECTION_KEY = 'selection';
const PROFILE_KEY = 'profile';

function readProfile(host: MainHost): Profile {
  const parsed = profileSchema.safeParse(host.storage.get(PROFILE_KEY) ?? {});
  return parsed.success ? parsed.data : profileSchema.parse({});
}

function readSelection(host: MainHost): Selection {
  const parsed = selectionSchema.safeParse(host.storage.get(SELECTION_KEY) ?? null);
  return parsed.success ? parsed.data : null;
}

function iconFor(content: Hd2Content, kind: string, id: string): string | undefined {
  switch (kind) {
    case 'weapon':
      return content.weapons[id]?.icon;
    case 'stratagem':
      return content.stratagems[id]?.icon;
    case 'armor':
      return content.armorPassives[id]?.icon;
    case 'booster':
      return content.boosters[id]?.icon;
    case 'warbond':
      return content.warbonds.find((warbond) => warbond.id === id)?.icon;
    case 'attachment':
      return content.customization.attachments[id]?.icon;
    default:
      return undefined;
  }
}

function allAssets(content: Hd2Content): AssetRef[] {
  const refs = (kind: string, entries: Record<string, { id: string; icon?: string }>) =>
    Object.values(entries)
      .filter((entry) => entry.icon)
      .map((entry) => ({ kind, id: entry.id }));
  return [
    ...refs('stratagem', content.stratagems),
    ...refs('weapon', content.weapons),
    ...refs('armor', content.armorPassives),
    ...refs('booster', content.boosters),
    ...refs('attachment', content.customization.attachments),
    ...content.warbonds.filter((warbond) => warbond.icon).map((warbond) => ({ kind: 'warbond', id: warbond.id })),
  ];
}

export const hd2Main: GameMainModule<Hd2State, Hd2Content> = {
  manifest,
  initialState: () => ({ phase: 'unknown' }),
  stateProviders: () => [
    {
      // Ship or mission, read from the screen's top-left corner while the game is in front.
      id: 'screen',
      priority: SCREEN_PRIORITY,
      start(host, emit) {
        const tracker = new PhaseTracker();
        let lastRead: Hd2State['phase'] | null = null;
        let busy = false;
        const timer = setInterval(() => {
          if (busy || !host.readScreen) return;
          busy = true;
          host
            .readScreen([CORNER])
            .then((texts) => {
              if (!texts) return;
              const lines = texts[CORNER.id] ?? [];
              const read = phaseFromCorner(lines);
              // What the corner said whenever a single read disagrees with the last one.
              if (read !== lastRead) host.log.info('Corner read', { read, text: lines.join(' | ') });
              lastRead = read;
              const phase = tracker.observe(read);
              if (phase) {
                host.log.info('Phase changed', { phase });
                emit({ phase });
              }
            })
            .catch((error: unknown) => host.log.warn('Screen read failed', { error: String(error) }))
            .finally(() => {
              busy = false;
            });
        }, SCREEN_INTERVAL_MS);
        return { dispose: () => clearInterval(timer) };
      },
    },
    {
      id: 'manual',
      priority: MANUAL_PRIORITY,
      start(host, emit) {
        const selection = readSelection(host);
        emit({ loadoutId: selection?.loadoutId });
        return { dispose() {} };
      },
    },
  ],
  content: {
    bundled: bundledContent,
    parse: parseContent,
    meta: ({ manifest: m }) => ({ version: m.version, updatedAt: m.updatedAt, gameVersion: m.gameVersion }),
    asset: (content, kind, id) => {
      const file = iconFor(content, kind, id);
      return file ? mediaWikiImage(IMAGE_BASE_URL, file, IMAGE_WIDTH) : null;
    },
    assets: allAssets,
  },
  actions: {
    [Hd2Action.GetSelection]: (_payload, { host }) => readSelection(host),
    [Hd2Action.GraphicsStatus]: () => graphicsStatus(),
    [Hd2Action.GraphicsApply]: async (_payload, { host }) => {
      const result = await applyLightingFix(host.isGameRunning());
      host.log.info('Lighting fix', { result });
      return result;
    },
    [Hd2Action.GraphicsRestore]: async (_payload, { host }) => {
      const result = await restoreBackup(host.isGameRunning());
      host.log.info('Settings restored from backup', { result });
      return result;
    },
    [Hd2Action.GetProfile]: (_payload, { host }) => readProfile(host),
    [Hd2Action.SetProfile]: (payload, { host }) => {
      const profile = profileSchema.parse(payload);
      host.storage.set(PROFILE_KEY, profile);
      return profile;
    },
    [Hd2Action.Select]: (payload, { host, updateState }) => {
      const selection = selectionSchema.parse(payload);
      host.storage.set(SELECTION_KEY, selection);
      updateState(MANUAL_PRIORITY, { loadoutId: selection?.loadoutId });
      return selection;
    },
  },
};
