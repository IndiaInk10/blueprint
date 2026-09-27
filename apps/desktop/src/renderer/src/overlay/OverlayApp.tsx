import { useEffect, useState, type CSSProperties } from 'react';
import { localize, type Anchor, type OverlayPanel } from '@guide/sdk';
import type { GameStatus, VisiblePanels } from '../../../shared/ipc';
import { GameUiHost, useContentBundle } from '../components/GameUiHost';
import { rendererModules } from '../games';
import { useResolvedLocale, useSettings } from '../hooks';

function anchorStyle({ edge, offset, size }: Anchor): CSSProperties {
  const style: CSSProperties = { width: size.width, height: size.height };
  if (edge === 'left' || edge === 'right') {
    style[edge] = offset.x;
    style.top = offset.y;
  } else {
    style[edge] = offset.y;
    style.left = offset.x;
  }
  return style;
}

export function OverlayApp({ gameId }: { gameId: string }) {
  const module = rendererModules.get(gameId);
  const [shown, setShown] = useState<VisiblePanels>({ panelIds: [], testing: false, interactive: false });
  const [status, setStatus] = useState<GameStatus | null>(null);
  const locale = useResolvedLocale(useSettings());

  useEffect(() => {
    if (!module) return;
    window.desktop.overlay.registerPanels(
      module.overlayPanels.map((panel) => ({ panelId: panel.id, visibility: panel.visibility, keys: panel.hotkey })),
    );
    return window.desktop.overlay.onVisiblePanelsChanged(setShown);
  }, [module]);

  useEffect(() => {
    void window.desktop.getGameStatuses().then((list) => {
      setStatus((current) => current ?? list.find((s) => s.gameId === gameId) ?? null);
    });
    return window.desktop.onGameStatusChanged((next) => {
      if (next.gameId === gameId) setStatus(next);
    });
  }, [gameId]);

  const bundle = useContentBundle(gameId, locale, status?.installDir);
  const state = status?.session?.state;
  if (!module || !state || !locale) return null;

  return (
    <GameUiHost gameId={gameId} locale={locale} bundle={bundle}>
      {module.overlayPanels
        // The settings test shows every panel, even ones limited to some game states.
        .filter((panel) => shown.panelIds.includes(panel.id) && (shown.testing || (panel.showWhen?.(state) ?? true)))
        .map((panel: OverlayPanel) => (
          <section
            key={panel.id}
            className={shown.interactive ? 'overlay-panel interactive' : 'overlay-panel'}
            style={anchorStyle(panel.defaultAnchor)}
            onMouseEnter={() => window.desktop.overlay.setPointerOver(true)}
            onMouseLeave={() => window.desktop.overlay.setPointerOver(false)}
          >
            <header className="overlay-panel-header">{localize(panel.title, locale)}</header>
            <div className="overlay-panel-body">
              <panel.component state={state} interactive={shown.interactive} />
            </div>
          </section>
        ))}
    </GameUiHost>
  );
}
