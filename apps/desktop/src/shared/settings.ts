// User settings shared by the main process (source of truth) and the renderer (settings UI).
// Everything defaults to "on": a missing entry means enabled.
import type { Locale } from '@guide/sdk';

export interface GameOverlaySettings {
  enabled?: boolean;
  /** panelId -> enabled */
  panels?: Record<string, boolean>;
  /**
   * panelId -> true: show whenever the game is in front; false: only while its hotkey is held.
   * Missing means the panel's own default.
   */
  alwaysShow?: Record<string, boolean>;
}

/** "system" follows the operating system's language. */
export type LocaleSetting = 'system' | Locale;
export const LOCALE_SETTINGS: readonly LocaleSetting[] = ['system', 'ko', 'en'];

export interface Settings {
  ui: {
    locale: LocaleSetting;
  };
  startup: {
    /** Start with Windows. */
    launchAtLogin: boolean;
    /** When started with Windows, stay in the tray instead of opening the window. */
    startHidden: boolean;
    /** Closing the window keeps the app (and its overlay) running in the tray. */
    closeToTray: boolean;
  };
  overlay: {
    enabled: boolean;
    games: Record<string, GameOverlaySettings>;
  };
}

export type SettingsUpdate =
  | { type: 'ui.locale'; locale: LocaleSetting }
  | { type: 'overlay.enabled'; enabled: boolean }
  | { type: 'overlay.game.enabled'; gameId: string; enabled: boolean }
  | { type: 'overlay.panel.enabled'; gameId: string; panelId: string; enabled: boolean }
  | { type: 'overlay.panel.alwaysShow'; gameId: string; panelId: string; enabled: boolean }
  | { type: StartupSetting; enabled: boolean };

export const STARTUP_SETTINGS = ['startup.launchAtLogin', 'startup.startHidden', 'startup.closeToTray'] as const;
export type StartupSetting = (typeof STARTUP_SETTINGS)[number];
const STARTUP_KEYS = { 'startup.launchAtLogin': 'launchAtLogin', 'startup.startHidden': 'startHidden', 'startup.closeToTray': 'closeToTray' } as const;

export function defaultSettings(): Settings {
  return {
    ui: { locale: 'system' },
    startup: { launchAtLogin: false, startHidden: true, closeToTray: true },
    overlay: { enabled: true, games: {} },
  };
}

/** The language to show. `systemLanguage` is e.g. navigator.language ("ko-KR", "en-US"). */
export function resolveLocale(setting: LocaleSetting, systemLanguage: string): Locale {
  if (setting !== 'system') return setting;
  return systemLanguage.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function isOverlayEnabledFor(settings: Settings, gameId: string): boolean {
  return settings.overlay.enabled && settings.overlay.games[gameId]?.enabled !== false;
}

export function isPanelEnabled(settings: Settings, gameId: string, panelId: string): boolean {
  return settings.overlay.games[gameId]?.panels?.[panelId] !== false;
}

/**
 * Whether a panel shows whenever the game is in front (true) or only while its hotkey is held
 * (false). Users can flip a panel's default either way, e.g. when an anti-cheat keeps other
 * programs from reading keys, or when they want a pinned panel out of the way.
 */
export function isPanelAlwaysShown(settings: Settings, gameId: string, panelId: string, byDefault: boolean): boolean {
  return settings.overlay.games[gameId]?.alwaysShow?.[panelId] ?? byDefault;
}

export function applySettingsUpdate(settings: Settings, update: SettingsUpdate): Settings {
  const { overlay } = settings;
  switch (update.type) {
    case 'ui.locale':
      return { ...settings, ui: { ...settings.ui, locale: update.locale } };
    case 'startup.launchAtLogin':
    case 'startup.startHidden':
    case 'startup.closeToTray':
      return { ...settings, startup: { ...settings.startup, [STARTUP_KEYS[update.type]]: update.enabled } };
    case 'overlay.enabled':
      return { ...settings, overlay: { ...overlay, enabled: update.enabled } };
    case 'overlay.game.enabled': {
      const game = overlay.games[update.gameId] ?? {};
      return {
        ...settings,
        overlay: { ...overlay, games: { ...overlay.games, [update.gameId]: { ...game, enabled: update.enabled } } },
      };
    }
    case 'overlay.panel.enabled': {
      const game = overlay.games[update.gameId] ?? {};
      const panels = { ...game.panels, [update.panelId]: update.enabled };
      return {
        ...settings,
        overlay: { ...overlay, games: { ...overlay.games, [update.gameId]: { ...game, panels } } },
      };
    }
    case 'overlay.panel.alwaysShow': {
      const game = overlay.games[update.gameId] ?? {};
      const alwaysShow = { ...game.alwaysShow, [update.panelId]: update.enabled };
      return {
        ...settings,
        overlay: { ...overlay, games: { ...overlay.games, [update.gameId]: { ...game, alwaysShow } } },
      };
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;

const isLocaleSetting = (value: unknown): value is LocaleSetting =>
  typeof value === 'string' && (LOCALE_SETTINGS as readonly string[]).includes(value);

export function isSettingsUpdate(value: unknown): value is SettingsUpdate {
  if (!isRecord(value)) return false;
  if (value['type'] === 'ui.locale') return isLocaleSetting(value['locale']);
  if (typeof value['enabled'] !== 'boolean') return false;
  switch (value['type']) {
    case 'overlay.enabled':
    case 'startup.launchAtLogin':
    case 'startup.startHidden':
    case 'startup.closeToTray':
      return true;
    case 'overlay.game.enabled':
      return isId(value['gameId']);
    case 'overlay.panel.enabled':
    case 'overlay.panel.alwaysShow':
      return isId(value['gameId']) && isId(value['panelId']);
    default:
      return false;
  }
}

/** Accepts anything read from disk and keeps only well-formed values. */
export function normalizeSettings(raw: unknown): Settings {
  const settings = defaultSettings();
  if (!isRecord(raw)) return settings;

  const ui = raw['ui'];
  if (isRecord(ui) && isLocaleSetting(ui['locale'])) settings.ui.locale = ui['locale'];

  const startup = raw['startup'];
  if (isRecord(startup)) {
    for (const key of ['launchAtLogin', 'startHidden', 'closeToTray'] as const) {
      if (typeof startup[key] === 'boolean') settings.startup[key] = startup[key];
    }
  }

  const overlay = raw['overlay'];
  if (!isRecord(overlay)) return settings;
  if (typeof overlay['enabled'] === 'boolean') settings.overlay.enabled = overlay['enabled'];
  const games = overlay['games'];
  if (isRecord(games)) {
    for (const [gameId, game] of Object.entries(games)) {
      if (!isId(gameId) || !isRecord(game)) continue;
      const normalized: GameOverlaySettings = {};
      if (typeof game['enabled'] === 'boolean') normalized.enabled = game['enabled'];
      const flags = (value: unknown) =>
        isRecord(value)
          ? Object.fromEntries(
              Object.entries(value).filter((entry): entry is [string, boolean] => isId(entry[0]) && typeof entry[1] === 'boolean'),
            )
          : undefined;
      const panels = flags(game['panels']);
      if (panels) normalized.panels = panels;
      const alwaysShow = flags(game['alwaysShow']);
      if (alwaysShow) normalized.alwaysShow = alwaysShow;
      settings.overlay.games[gameId] = normalized;
    }
  }
  return settings;
}
