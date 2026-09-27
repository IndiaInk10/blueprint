// Pure data shared by the main process and the renderer. No runtime dependencies allowed here.

export type Locale = 'ko' | 'en';

/** English is required as the fallback for every other locale. */
export type LocalizedText = { en: string } & Partial<Record<Locale, string>>;

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}

export type AntiCheat = 'none' | 'vac' | 'eac' | 'battleye' | 'vanguard' | 'gameguard' | 'unknown';

export type OverlayBackendId = 'window' | 'detached' | 'injected';

export interface WindowMatch {
  title: string;
  mode: 'exact' | 'contains';
}

export interface GameManifest {
  /** Stable id used for routing, settings keys and content paths. */
  id: string;
  displayName: LocalizedText;
  steamAppId?: number;
  process: { exe: string[] };
  window: WindowMatch[];
  antiCheat: AntiCheat;
  /** Allowed overlay backends, in order of preference. */
  overlay: { backends: OverlayBackendId[] };
}
