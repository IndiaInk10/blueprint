import { useState } from 'react';
import { localize, type GameManifest } from '@guide/sdk';
import type { GameStatus } from '../../../shared/ipc';
import { SteamArt } from '../components/SteamArt';
import { useLocale, useMessages } from '../i18n';

interface SidebarProps {
  games: GameManifest[];
  statuses: Record<string, GameStatus>;
  selectedId: string | null;
  onSelect: (gameId: string) => void;
}

export function Sidebar({ games, statuses, selectedId, onSelect }: SidebarProps) {
  const locale = useLocale();
  const t = useMessages();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  // Search matches the game's name in every language, not only the current one.
  const filtered = games.filter((game) =>
    Object.values(game.displayName).some((name) => name?.toLowerCase().includes(needle)),
  );

  return (
    <aside className="sidebar">
      <input
        className="sidebar-search"
        type="search"
        placeholder={t.sidebar.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="sidebar-section">{t.sidebar.supported(filtered.length)}</div>
      <ul className="game-list">
        {filtered.map((game) => {
          const running = !!statuses[game.id]?.session;
          const classes = ['game-item', game.id === selectedId && 'active', running && 'running'].filter(Boolean);
          return (
            <li key={game.id}>
              <button type="button" className={classes.join(' ')} onClick={() => onSelect(game.id)}>
                <SteamArt
                  appId={game.steamAppId}
                  kind="icon"
                  className="game-icon"
                  fallback={<span className="game-icon" />}
                />
                <span className="game-item-name">{localize(game.displayName, locale)}</span>
                {running && <span className="game-item-status">{t.sidebar.running}</span>}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="sidebar-empty">{t.sidebar.noResults}</li>}
      </ul>
    </aside>
  );
}
