// Contract for the main-process (Node) half of a game module.
import type { GameManifest, Locale } from './manifest';

export type GameState = object;

export interface Disposable {
  dispose(): void;
}

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Small persistent key-value store scoped to one game. Values must be JSON-serializable. */
export interface KeyValueStorage {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/** The limited API the core hands to a game module. Grows as modules need it. */
export interface MainHost {
  log: Logger;
  storage: KeyValueStorage;
  /** Install directory of the game, or null while unknown or not installed. */
  installDir(): string | null;
  /**
   * Reads text from parts of the game window with the OS's OCR, the way a screenshot would: the
   * game process is never touched. Resolves to the text lines per region id, or null while the
   * game window is not in front (then the screen shows something else). Absent where unsupported.
   */
  readScreen?(regions: ScreenRegionSpec[]): Promise<Record<string, string[]> | null>;
}

/** Part of the game window, as fractions (0..1) of its client area. */
export interface ScreenRegionSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Enlargement before OCR; 2 (the default) suits small HUD text. */
  scale?: number;
}

export interface StateProvider<S extends GameState> {
  id: string;
  /** Higher wins when two providers write the same field. */
  priority: number;
  start(host: MainHost, emit: (patch: Partial<S>) => void): Disposable;
}

/**
 * Guide content (builds, tips, ...). The core fetches raw documents from a source — bundled with
 * the app today, a remote CDN later — and asks the module to validate them, so every source goes
 * through the same checks.
 */
export interface GameContentProvider<C = unknown> {
  /** Raw documents shipped with the app. */
  bundled(): unknown;
  /** Validates raw documents from any source. Throws an Error with a readable message when invalid. */
  parse(raw: unknown): C;
  /** Display strings for ids used in the content, e.g. names read from the local game install. */
  strings?(content: C, locale: Locale, host: MainHost): Promise<Record<string, string>>;
  /** Release information of validated content, shown to users and used to compare sources. */
  meta(content: C): ContentMeta;
  /**
   * Remote https URL of an image (e.g. kind "item", id "Syringe"), or null when there is none.
   * A list gives candidates in order of preference, e.g. a small thumbnail, then the original.
   * The core downloads it once into a local cache; images are never bundled with the app.
   */
  asset?(content: C, kind: string, id: string): string | readonly string[] | null;
  /** Every image the content uses. The core downloads them in the background so views open instantly. */
  assets?(content: C): AssetRef[];
}

export interface AssetRef {
  kind: string;
  id: string;
}

/**
 * URLs for an image on a MediaWiki site (e.g. a game wiki): a thumbnail `width` pixels wide, then
 * the original. Wiki originals can be several megabytes; thumbnails are a few kilobytes. Vector
 * images are small already, and MediaWiki would rasterize their thumbnails, so they stay as they are.
 */
export function mediaWikiImage(imageBaseUrl: string, file: string, width: number): string[] {
  const name = encodeURIComponent(file.replaceAll(' ', '_'));
  const original = `${imageBaseUrl}${name}`;
  return /\.svg$/i.test(file) ? [original] : [`${imageBaseUrl}thumb/${name}/${width}px-${name}`, original];
}

export interface ContentMeta {
  /** Content release, e.g. "2026.09.26.1". */
  version: string;
  /** ISO date of the last content change. */
  updatedAt: string;
  /** Game version the content was checked against. */
  gameVersion?: string;
}

export interface ContentBundle<C = unknown> {
  content: C;
  meta: ContentMeta;
  /** Which source provided the content, e.g. "bundled". */
  source: string;
  strings: Record<string, string>;
}

export interface ActionContext<S extends GameState = GameState> {
  host: MainHost;
  /** Applies a patch to the running session's state. Does nothing while the game is not running. */
  updateState(priority: number, patch: Partial<S>): void;
}

/** Called by the renderer through the core. Validate `payload`: it crosses a process boundary. */
export type ActionHandler<S extends GameState = GameState> = (
  payload: unknown,
  context: ActionContext<S>,
) => unknown | Promise<unknown>;

export interface GameMainModule<S extends GameState = GameState, C = unknown> {
  manifest: GameManifest;
  initialState(): S;
  stateProviders(host: MainHost): StateProvider<S>[];
  content?: GameContentProvider<C>;
  actions?: Record<string, ActionHandler<S>>;
}

/** Registries hold modules with different state types, so the state type is erased there. */
export type AnyGameMainModule = GameMainModule<any, any>;
