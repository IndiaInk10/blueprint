import type { ContentBundle, GameManifest, Locale, PanelVisibility } from '@guide/sdk';
import type { Settings, SettingsUpdate } from './settings';

/**
 * Bumped on breaking changes to DesktopApi, so a UI loaded from elsewhere (e.g. hosted remotely
 * in the future) can check what the installed app supports.
 */
export const DESKTOP_API_VERSION = 1;

export const IpcChannel = {
  ListGames: 'games:list',
  GetStatuses: 'games:statuses',
  StatusChanged: 'games:status-changed',
  GetContent: 'games:content',
  InvokeAction: 'games:invoke-action',
  GetSettings: 'settings:get',
  GetSystemLanguage: 'settings:system-language',
  UpdateSettings: 'settings:update',
  SettingsChanged: 'settings:changed',
  OverlayRegisterPanels: 'overlay:register-panels',
  OverlayVisiblePanels: 'overlay:visible-panels',
  OverlayTest: 'overlay:test',
  OverlayStatus: 'overlay:status',
  OverlayPointer: 'overlay:pointer',
} as const;

/** What the overlay is doing for one game, for the settings screen's test section. */
export interface OverlayStatus {
  running: boolean;
  /** The overlay found the game's window and follows it. */
  tracking: boolean;
  /** The game window is in front (the overlay only shows then). */
  gameFocused: boolean;
  /** When a panel's hotkey was last seen held, as epoch ms; null when never. */
  lastHotkeyAt: number | null;
  /** When a forced test display ends, as epoch ms; null when no test is running. */
  testUntil: number | null;
}

/** Which panels the overlay should draw. During a test, panels also ignore their own showWhen. */
export interface VisiblePanels {
  panelIds: string[];
  testing: boolean;
  /** The game's menu is open: panels may take the mouse while it is over them. */
  interactive: boolean;
}

export type OverlayTestResult = 'started' | 'not-running' | 'disabled' | 'no-window';

export interface SessionInfo {
  pid: number;
  startedAt: number;
  state: object;
}

export interface GameStatus {
  gameId: string;
  /** Null when the game is not installed or could not be located. */
  installDir: string | null;
  /** Null when the game is not running. */
  session: SessionInfo | null;
}

/** What the overlay renderer tells the main process about each panel it can draw. */
export interface PanelRegistration {
  panelId: string;
  visibility: PanelVisibility;
  /** Windows virtual-key codes, all held together. */
  keys?: number[];
}

/** The API the preload script exposes to the renderer as `window.desktop`. */
export interface DesktopApi {
  apiVersion: number;
  listGames(): Promise<GameManifest[]>;
  getGameStatuses(): Promise<GameStatus[]>;
  /** Returns an unsubscribe function. */
  onGameStatusChanged(listener: (status: GameStatus) => void): () => void;
  /** Null when the game has no valid content. */
  getContent(gameId: string, locale: Locale): Promise<ContentBundle | null>;
  invokeGameAction(gameId: string, action: string, payload?: unknown): Promise<unknown>;
  getSettings(): Promise<Settings>;
  /** The user's preferred OS language, e.g. "ko-KR"; used when the UI language follows the system. */
  getSystemLanguage(): Promise<string>;
  updateSettings(update: SettingsUpdate): Promise<Settings>;
  /** Returns an unsubscribe function. */
  onSettingsChanged(listener: (settings: Settings) => void): () => void;
  overlay: {
    /** Only honored when called from the overlay window. */
    registerPanels(panels: PanelRegistration[]): void;
    /** Returns an unsubscribe function. */
    onVisiblePanelsChanged(listener: (shown: VisiblePanels) => void): () => void;
    /** Shows every enabled panel of a running game for a few seconds, ignoring hotkeys and focus. */
    test(gameId: string): Promise<OverlayTestResult>;
    status(gameId: string): Promise<OverlayStatus>;
    /** Only honored from the overlay window: the pointer entered (true) or left (false) a panel. */
    setPointerOver(over: boolean): void;
  };
}
