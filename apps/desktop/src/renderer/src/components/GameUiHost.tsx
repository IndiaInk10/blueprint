import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ContentBundle, GameUi, Locale, NavigationTarget } from '@guide/sdk';
import { GameUiContext } from '@guide/sdk/react';
import { gameAssetUrl } from '../../../shared/gameAsset';

/**
 * Loads a game's content bundle. Display names come from the game install, so the bundle is
 * refetched once the install directory is known.
 */
export function useContentBundle(gameId: string, locale: Locale | null, installDir: string | null | undefined) {
  const [bundle, setBundle] = useState<ContentBundle | null>(null);

  useEffect(() => {
    // Wait until the UI language is known rather than fetching names in the wrong language.
    if (!locale) return;
    let cancelled = false;
    window.desktop.getContent(gameId, locale).then(
      (next) => !cancelled && setBundle(next),
      () => !cancelled && setBundle(null),
    );
    return () => {
      cancelled = true;
    };
  }, [gameId, locale, installDir]);

  return bundle;
}

interface GameUiHostProps {
  gameId: string;
  locale: Locale;
  bundle: ContentBundle | null;
  children: ReactNode;
  /** Views that cannot navigate (overlay panels, credits) leave these out. */
  target?: NavigationTarget | null;
  navigate?: (viewId: string, entryId?: string) => void;
}

const noNavigation = () => {};

/** Gives a game module's components everything they may use from the host. */
export function GameUiHost({ gameId, locale, bundle, children, target = null, navigate = noNavigation }: GameUiHostProps) {
  const ui = useMemo<GameUi>(
    () => ({
      locale,
      content: bundle?.content ?? null,
      meta: bundle?.meta ?? null,
      text: (id, fallback) => bundle?.strings[id] ?? fallback ?? id,
      invoke: (action, payload) => window.desktop.invokeGameAction(gameId, action, payload),
      assetUrl: (kind, id) => gameAssetUrl(gameId, kind, id),
      target,
      navigate,
    }),
    [bundle, gameId, locale, target, navigate],
  );

  return <GameUiContext.Provider value={ui}>{children}</GameUiContext.Provider>;
}
