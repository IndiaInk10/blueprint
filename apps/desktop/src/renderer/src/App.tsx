import { useState } from 'react';
import { Logo } from './components/Logo';
import { useGames, useGameStatuses, useResolvedLocale, useSettings } from './hooks';
import { LocaleContext, useMessages } from './i18n';
import { GamePage } from './library/GamePage';
import { Sidebar } from './library/Sidebar';
import { SettingsPage } from './settings/SettingsPage';

type Page = 'library' | 'settings';
const PAGES: Page[] = ['library', 'settings'];

export function App() {
  const settings = useSettings();
  const locale = useResolvedLocale(settings);
  if (!locale) return null;
  return (
    <LocaleContext.Provider value={locale}>
      <Shell settings={settings} />
    </LocaleContext.Provider>
  );
}

function Shell({ settings }: { settings: ReturnType<typeof useSettings> }) {
  const t = useMessages();
  const games = useGames();
  const statuses = useGameStatuses();
  const [page, setPage] = useState<Page>('library');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = games.find((game) => game.id === selectedId) ?? games[0];

  return (
    <div className="app">
      <header className="topbar">
        <Logo />
        <nav className="topbar-nav">
          {PAGES.map((id) => (
            <button
              key={id}
              type="button"
              className={page === id ? 'topbar-tab active' : 'topbar-tab'}
              onClick={() => setPage(id)}
            >
              {t.nav[id]}
            </button>
          ))}
        </nav>
      </header>

      {page === 'library' ? (
        <div className="library">
          <Sidebar games={games} statuses={statuses} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          {selected ? (
            <GamePage
              key={selected.id}
              game={selected}
              status={statuses[selected.id]}
              settings={settings}
              onOpenSettings={() => setPage('settings')}
            />
          ) : (
            <div className="empty-state">{t.selectGame}</div>
          )}
        </div>
      ) : (
        <SettingsPage games={games} settings={settings} />
      )}
    </div>
  );
}
