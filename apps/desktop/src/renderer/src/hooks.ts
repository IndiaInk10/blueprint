import { useEffect, useState } from 'react';
import type { GameManifest, Locale } from '@guide/sdk';
import type { GameStatus } from '../../shared/ipc';
import { resolveLocale, type Settings } from '../../shared/settings';

export function useGames(): GameManifest[] {
  const [games, setGames] = useState<GameManifest[]>([]);
  useEffect(() => {
    void window.desktop.listGames().then(setGames);
  }, []);
  return games;
}

export function useGameStatuses(): Record<string, GameStatus> {
  const [statuses, setStatuses] = useState<Record<string, GameStatus>>({});
  useEffect(() => {
    void window.desktop.getGameStatuses().then((list) => {
      // Pushed updates may arrive before the initial fetch resolves; they are newer.
      setStatuses((current) => ({ ...Object.fromEntries(list.map((s) => [s.gameId, s])), ...current }));
    });
    return window.desktop.onGameStatusChanged((status) => {
      setStatuses((current) => ({ ...current, [status.gameId]: status }));
    });
  }, []);
  return statuses;
}

/**
 * The UI language from settings (following the OS when set to "system"), mirrored on <html lang>.
 * Null until both settings and the OS language are known, so the first paint is already in the
 * right language instead of flashing another one.
 */
export function useResolvedLocale(settings: Settings | null): Locale | null {
  const [systemLanguage, setSystemLanguage] = useState<string | null>(null);
  useEffect(() => {
    window.desktop.getSystemLanguage().then(setSystemLanguage, () => setSystemLanguage(navigator.language));
  }, []);
  const locale = settings && systemLanguage !== null ? resolveLocale(settings.ui.locale, systemLanguage) : null;
  useEffect(() => {
    if (locale) document.documentElement.lang = locale;
  }, [locale]);
  return locale;
}

export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void window.desktop.getSettings().then((initial) => setSettings((current) => current ?? initial));
    return window.desktop.onSettingsChanged(setSettings);
  }, []);
  return settings;
}
