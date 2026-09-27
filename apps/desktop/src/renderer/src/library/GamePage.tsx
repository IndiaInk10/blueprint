import { useCallback, useEffect, useMemo, useState } from 'react';
import { localize, type AnyGameRendererModule, type GameManifest, type NavigationTarget, type SearchEntry } from '@guide/sdk';
import { useGameUi } from '@guide/sdk/react';
import type { GameStatus } from '../../../shared/ipc';
import { isOverlayEnabledFor, type Settings } from '../../../shared/settings';
import { GameUiHost, useContentBundle } from '../components/GameUiHost';
import { SteamArt } from '../components/SteamArt';
import { rendererModules } from '../games';
import { useLocale, useMessages } from '../i18n';
import { SearchPalette } from './SearchPalette';

interface GamePageProps {
  game: GameManifest;
  status: GameStatus | undefined;
  settings: Settings | null;
  onOpenSettings: () => void;
}

type StatusKind = 'running' | 'installed' | 'missing';

function statusKind(status: GameStatus | undefined): StatusKind {
  if (status?.session) return 'running';
  return status?.installDir ? 'installed' : 'missing';
}

const viewKey = (gameId: string) => `blueprint:${gameId}:view`;

function rememberedView(gameId: string): string | null {
  try {
    return localStorage.getItem(viewKey(gameId));
  } catch {
    return null;
  }
}

/** Collects the module's search entries inside the host context, where content is available. */
function GameSearch({ module, onPick, onClose }: { module: AnyGameRendererModule; onPick: (entry: SearchEntry) => void; onClose: () => void }) {
  const ui = useGameUi();
  const entries = useMemo(() => (ui.content && module.search ? module.search(ui) : []), [module, ui]);
  return <SearchPalette entries={entries} onPick={onPick} onClose={onClose} />;
}

export function GamePage({ game, status, settings, onOpenSettings }: GamePageProps) {
  const locale = useLocale();
  const t = useMessages();
  const module = rendererModules.get(game.id);
  const views = module?.appViews ?? [];
  const [viewId, setViewId] = useState<string | null>(() => rememberedView(game.id));
  const [target, setTarget] = useState<NavigationTarget | null>(null);
  const [searching, setSearching] = useState(false);
  const activeView = views.find((view) => view.id === viewId) ?? views[0];
  const View = activeView?.component;

  const bundle = useContentBundle(game.id, locale, status?.installDir);
  const kind = statusKind(status);
  const name = localize(game.displayName, locale);
  const overlayOn = settings ? isOverlayEnabledFor(settings, game.id) : null;

  const openView = useCallback(
    (next: string) => {
      setViewId(next);
      try {
        localStorage.setItem(viewKey(game.id), next);
      } catch {
        // The tab still switches; it just is not remembered.
      }
    },
    [game.id],
  );

  const navigate = useCallback(
    (nextView: string, entryId?: string) => {
      openView(nextView);
      setTarget((previous) => ({ viewId: nextView, entryId: entryId ?? null, seq: (previous?.seq ?? 0) + 1 }));
    },
    [openView],
  );

  // Ctrl+K (or Ctrl+F) opens search from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K' || event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="game-page">
      <header className="game-header">
        <SteamArt appId={game.steamAppId} kind="hero" className="game-header-art" />
        <div className="game-header-content">
          <SteamArt
            appId={game.steamAppId}
            kind="logo"
            className="game-header-logo"
            alt={name}
            fallback={<h1 className="game-header-title">{name}</h1>}
          />
          <div className="game-header-facts">
            <span className={`status-pill ${kind}`} title={status?.installDir ?? t.game.notFound}>
              {t.status[kind]}
            </span>
            <span className="game-header-fact">
              {t.game.overlay}{' '}
              <span className={overlayOn ? 'on' : 'off'}>{overlayOn === null ? '—' : overlayOn ? t.game.on : t.game.off}</span>{' '}
              <button type="button" className="link-button" onClick={onOpenSettings}>
                {t.game.change}
              </button>
            </span>
            {bundle && (
              <span
                className="game-header-fact"
                title={bundle.meta.gameVersion ? t.game.checkedAgainst(bundle.meta.gameVersion) : undefined}
              >
                {t.game.content} v{bundle.meta.version}
              </span>
            )}
          </div>
        </div>
      </header>

      {views.length > 0 && (
        <nav className="view-tabs">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={view === activeView ? 'view-tab active' : 'view-tab'}
              onClick={() => openView(view.id)}
            >
              {localize(view.title, locale)}
            </button>
          ))}
          {module?.search && (
            <button type="button" className="view-search" onClick={() => setSearching(true)}>
              <svg viewBox="0 0 16 16" aria-hidden>
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              {t.search.button}
              <kbd>{t.search.shortcut}</kbd>
            </button>
          )}
        </nav>
      )}
      <div className="view-body">
        <GameUiHost gameId={game.id} locale={locale} bundle={bundle} target={target} navigate={navigate}>
          {View && <View />}
          {searching && module && (
            <GameSearch
              module={module}
              onClose={() => setSearching(false)}
              onPick={(entry) => {
                setSearching(false);
                navigate(entry.viewId, entry.entryId);
              }}
            />
          )}
        </GameUiHost>
      </div>
    </div>
  );
}
