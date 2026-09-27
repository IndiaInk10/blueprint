// Contract for the renderer (React) half of a game module. Types only: runtime helpers live in ./react.
import type { ComponentType } from 'react';
import type { ContentMeta, GameState } from './main';
import type { GameManifest, Locale, LocalizedText } from './manifest';

/** A tab in the main window. */
export interface AppView {
  id: string;
  title: LocalizedText;
  component: ComponentType;
}

export interface Anchor {
  edge: 'left' | 'right' | 'top' | 'bottom';
  offset: { x: number; y: number };
  /** Height is sized to the content when omitted. */
  size: { width: number; height?: number };
}

/**
 * - pinned: shown whenever the game is focused (unless the user turned the panel off)
 * - hold-hotkey: shown while the hotkey is held
 * - toggle: each hotkey press shows or hides it
 */
export type PanelVisibility = 'pinned' | 'hold-hotkey' | 'toggle';

export interface OverlayPanel<S extends GameState = GameState> {
  id: string;
  /** Shown in the settings screen. */
  title: LocalizedText;
  component: ComponentType<{ state: S }>;
  /** Hides the panel in some game states, e.g. show a loadout summary only on the ship. */
  showWhen?: (state: S) => boolean;
  defaultAnchor: Anchor;
  visibility: PanelVisibility;
  /**
   * Windows virtual-key codes, all held together. Required for hold-hotkey and toggle; on a pinned
   * panel it lets the user switch the panel to "only while holding" in settings.
   */
  hotkey?: number[];
}

export interface GameRendererModule<S extends GameState = GameState> {
  manifest: GameManifest;
  appViews: AppView[];
  overlayPanels: OverlayPanel<S>[];
  /** Data sources and credits, shown out of the way under Settings → About. */
  creditsView?: ComponentType;
  /** Everything worth jumping to from the host's global search. Called with the loaded content. */
  search?: (ui: GameUi<any>) => SearchEntry[];
}

/** Registries hold modules with different state types, so the state type is erased there. */
export type AnyGameRendererModule = GameRendererModule<any>;

/**
 * Everything a game module's components may use from the host. Modules must not touch
 * `window.desktop` directly, so the host can change transport (IPC today, a hosted UI later)
 * without module changes.
 */
export interface GameUi<C = unknown> {
  locale: Locale;
  /** Null while loading or when the content failed validation. */
  content: C | null;
  meta: ContentMeta | null;
  /** Resolves a string id (e.g. a game localization token), falling back when it is unknown. */
  text(id: string, fallback?: string): string;
  /** Calls one of the module's main-process actions. */
  invoke(action: string, payload?: unknown): Promise<unknown>;
  /** URL for an image the module's content provider resolves (see GameContentProvider.asset). */
  assetUrl(kind: string, id: string): string;
  /** What the user last asked this game to show: set by search or by another view's link. */
  target: NavigationTarget | null;
  /** Opens one of this game's views, optionally at a specific entry (e.g. a combo id). */
  navigate(viewId: string, entryId?: string): void;
}

/** A request to show an entry. `seq` changes on every request, so asking twice for the same entry still works. */
export interface NavigationTarget {
  viewId: string;
  entryId: string | null;
  seq: number;
}

/** One hit in the host's global search (Ctrl+K). */
export interface SearchEntry {
  /** Unique within the game. */
  key: string;
  title: string;
  /** Short line under the title, e.g. the category or tier. */
  subtitle?: string;
  /** Group label shown in the result list, e.g. "Weapons". */
  group: string;
  icon?: string;
  /** Extra words that should match, e.g. the English name in the Korean UI. */
  keywords?: string[];
  viewId: string;
  entryId: string;
}
