import { useEffect, useState } from 'react';
import type { OverlayStatus } from '../../../shared/ipc';
import { localize, type GameManifest, type OverlayPanel } from '@guide/sdk';
import {
  isOverlayEnabledFor,
  isPanelAlwaysShown,
  isPanelEnabled,
  LOCALE_SETTINGS,
  type LocaleSetting,
  type Settings,
  type SettingsUpdate,
} from '../../../shared/settings';
import { GameUiHost, useContentBundle } from '../components/GameUiHost';
import { APP_NAME } from '../components/Logo';
import { SteamArt } from '../components/SteamArt';
import { Toggle } from '../components/Toggle';
import { rendererModules } from '../games';
import { LOCALE_NAMES, useLocale, useMessages, type Messages } from '../i18n';

const KEY_NAMES: Record<number, string> = { 0x09: 'Tab', 0x10: 'Shift', 0x11: 'Ctrl', 0x12: 'Alt', 0x20: 'Space' };

function keyName(vk: number): string {
  if (KEY_NAMES[vk]) return KEY_NAMES[vk];
  if ((vk >= 0x30 && vk <= 0x39) || (vk >= 0x41 && vk <= 0x5a)) return String.fromCharCode(vk);
  if (vk >= 0x70 && vk <= 0x87) return `F${vk - 0x6f}`;
  return `VK ${vk}`;
}

function describePanel(panel: OverlayPanel, t: Messages): string {
  const keys = panel.hotkey?.map(keyName).join(' + ') ?? '';
  switch (panel.visibility) {
    case 'pinned':
      return t.settings.pinned;
    case 'hold-hotkey':
      return t.settings.holdHotkey(keys);
    case 'toggle':
      return t.settings.toggle(keys);
  }
}

type Category = 'general' | 'overlay' | 'about';

interface SettingsPageProps {
  games: GameManifest[];
  settings: Settings | null;
}

export function SettingsPage({ games, settings }: SettingsPageProps) {
  const t = useMessages();
  const [category, setCategory] = useState<Category>('general');
  const update = (change: SettingsUpdate) => void window.desktop.updateSettings(change);
  const categories: { id: Category; label: string }[] = [
    { id: 'general', label: t.settings.general },
    { id: 'overlay', label: t.settings.overlayTitle },
    { id: 'about', label: t.settings.about },
  ];

  return (
    <div className="settings">
      <nav className="settings-nav">
        {categories.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={category === id ? 'settings-nav-item active' : 'settings-nav-item'}
            onClick={() => setCategory(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="settings-body">
        {settings && category === 'general' && <GeneralSettings settings={settings} update={update} />}
        {settings && category === 'overlay' && <OverlaySettings games={games} settings={settings} update={update} />}
        {category === 'about' && <About games={games} />}
      </div>
    </div>
  );
}

interface SectionProps {
  settings: Settings;
  update: (change: SettingsUpdate) => void;
}

function GeneralSettings({ settings, update }: SectionProps) {
  const t = useMessages();
  const label = (option: LocaleSetting) => (option === 'system' ? t.settings.followSystem : LOCALE_NAMES[option]);
  return (
    <>
      <h2 className="settings-title">{t.settings.general}</h2>
      <section className="settings-group">
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-label">{t.settings.language}</div>
            <div className="setting-description">{t.settings.languageDescription}</div>
          </div>
          <div className="segmented" role="radiogroup" aria-label={t.settings.language}>
            {LOCALE_SETTINGS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={settings.ui.locale === option}
                className={settings.ui.locale === option ? 'segmented-option active' : 'segmented-option'}
                onClick={() => update({ type: 'ui.locale', locale: option })}
              >
                {label(option)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-group">
        <div className="settings-group-title">{t.settings.startup.title}</div>
        {(
          [
            ['startup.launchAtLogin', settings.startup.launchAtLogin, t.settings.startup.launchAtLogin, t.settings.startup.launchAtLoginDescription, false],
            ['startup.startHidden', settings.startup.startHidden, t.settings.startup.startHidden, t.settings.startup.startHiddenDescription, !settings.startup.launchAtLogin],
            ['startup.closeToTray', settings.startup.closeToTray, t.settings.startup.closeToTray, t.settings.startup.closeToTrayDescription, false],
          ] as const
        ).map(([type, checked, label, description, disabled]) => (
          <div key={type} className={disabled ? 'setting-row disabled' : 'setting-row'}>
            <div className="setting-text">
              <div className="setting-label">{label}</div>
              <div className="setting-description">{description}</div>
            </div>
            <Toggle label={label} checked={checked} disabled={disabled} onChange={(enabled) => update({ type, enabled })} />
          </div>
        ))}
      </section>
    </>
  );
}

const STATUS_POLL_MS = 1000;

/** Test button plus what the overlay sees right now: game, window, focus and the last key press. */
function OverlayTest({ gameId, disabled }: { gameId: string; disabled: boolean }) {
  const t = useMessages();
  const [status, setStatus] = useState<OverlayStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const poll = () =>
      void window.desktop.overlay.status(gameId).then((next) => {
        if (!alive) return;
        setStatus(next);
        setNow(Date.now());
      });
    poll();
    const timer = setInterval(poll, STATUS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [gameId]);

  const run = async () => {
    const result = await window.desktop.overlay.test(gameId);
    setMessage(result === 'started' ? null : (t.settings.test.results[result] ?? null));
  };

  const seconds = (at: number) => Math.max(0, Math.round((at - now) / 1000));
  const facts = !status
    ? []
    : !status.running
      ? [t.settings.test.notRunning]
      : !status.tracking
        ? [t.settings.test.noWindow]
        : [
            t.settings.test.tracking,
            status.gameFocused ? t.settings.test.focused : t.settings.test.notFocused,
            status.lastHotkeyAt ? t.settings.test.keySeen(-seconds(status.lastHotkeyAt)) : t.settings.test.keyNever,
          ];

  return (
    <div className={disabled ? 'setting-row nested disabled' : 'setting-row nested'}>
      <div className="setting-text">
        <div className="setting-label">{t.settings.test.label}</div>
        <div className="setting-description">{t.settings.test.description}</div>
        {facts.length > 0 && <div className="setting-status">{facts.join(' · ')}</div>}
        {message && <div className="setting-status warn">{message}</div>}
      </div>
      <button type="button" className="setting-button" disabled={disabled || !!status?.testUntil} onClick={() => void run()}>
        {status?.testUntil ? t.settings.test.running(seconds(status.testUntil)) : t.settings.test.button}
      </button>
    </div>
  );
}

function OverlaySettings({ games, settings, update }: SectionProps & { games: GameManifest[] }) {
  const locale = useLocale();
  const t = useMessages();
  return (
    <>
      <h2 className="settings-title">{t.settings.overlayTitle}</h2>
      <p className="settings-lead">{t.settings.overlayLead}</p>

      <section className="settings-group">
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-label">{t.settings.overlayEnabled}</div>
            <div className="setting-description">{t.settings.overlayEnabledDescription}</div>
          </div>
          <Toggle
            label={t.settings.overlayEnabled}
            checked={settings.overlay.enabled}
            onChange={(enabled) => update({ type: 'overlay.enabled', enabled })}
          />
        </div>
      </section>

      {games.map((game) => {
        const name = localize(game.displayName, locale);
        const panels = rendererModules.get(game.id)?.overlayPanels ?? [];
        const gameOn = isOverlayEnabledFor(settings, game.id);
        return (
          <section key={game.id} className="settings-group">
            <div className="settings-group-title">
              <SteamArt appId={game.steamAppId} kind="icon" className="game-icon" />
              {name}
            </div>
            <div className={settings.overlay.enabled ? 'setting-row' : 'setting-row disabled'}>
              <div className="setting-text">
                <div className="setting-label">{t.settings.gameEnabled}</div>
              </div>
              <Toggle
                label={t.settings.gameEnabledLabel(name)}
                checked={settings.overlay.games[game.id]?.enabled !== false}
                disabled={!settings.overlay.enabled}
                onChange={(enabled) => update({ type: 'overlay.game.enabled', gameId: game.id, enabled })}
              />
            </div>
            {panels.length > 0 && <OverlayTest gameId={game.id} disabled={!gameOn} />}
            {panels.map((panel) => {
              const title = localize(panel.title, locale);
              const pinnedByDefault = panel.visibility === 'pinned';
              const always = isPanelAlwaysShown(settings, game.id, panel.id, pinnedByDefault);
              const keys = panel.hotkey?.map(keyName).join(' + ') ?? '';
              // A pinned panel with a hotkey can be switched to hold-to-show, and the other way round.
              const switchable = !!panel.hotkey?.length;
              return (
                <div key={panel.id} className={gameOn ? 'setting-row nested' : 'setting-row nested disabled'}>
                  <div className="setting-text">
                    <div className="setting-label">{title}</div>
                    <div className="setting-description">
                      {always ? t.settings.pinned : panel.visibility === 'toggle' ? describePanel(panel, t) : t.settings.holdHotkey(keys)}
                    </div>
                    {switchable && (
                      <label className="setting-check">
                        <input
                          type="checkbox"
                          checked={!always}
                          disabled={!gameOn}
                          onChange={(event) =>
                            update({ type: 'overlay.panel.alwaysShow', gameId: game.id, panelId: panel.id, enabled: !event.target.checked })
                          }
                        />
                        {t.settings.onlyWhileHolding(keys)}
                        {!pinnedByDefault && <span className="setting-check-hint">{t.settings.alwaysShowHint}</span>}
                      </label>
                    )}
                  </div>
                  <Toggle
                    label={t.settings.showPanel(title)}
                    checked={isPanelEnabled(settings, game.id, panel.id)}
                    disabled={!gameOn}
                    onChange={(enabled) =>
                      update({ type: 'overlay.panel.enabled', gameId: game.id, panelId: panel.id, enabled })
                    }
                  />
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

function About({ games }: { games: GameManifest[] }) {
  const t = useMessages();
  return (
    <>
      <h2 className="settings-title">{t.settings.about}</h2>
      <section className="settings-group">
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-label">{APP_NAME}</div>
          </div>
        </div>
      </section>
      {games.map((game) => (
        <GameCredits key={game.id} game={game} />
      ))}
    </>
  );
}

/** A game module's own credits view, given the same content access as its other views. */
function GameCredits({ game }: { game: GameManifest }) {
  const locale = useLocale();
  const t = useMessages();
  const Credits = rendererModules.get(game.id)?.creditsView;
  const bundle = useContentBundle(game.id, locale, null);
  if (!Credits) return null;
  return (
    <section className="settings-group">
      <div className="settings-group-title">
        <SteamArt appId={game.steamAppId} kind="icon" className="game-icon" />
        {localize(game.displayName, locale)} · {t.settings.dataSources}
      </div>
      <div className="setting-row">
        <div className="setting-text">
          <GameUiHost gameId={game.id} locale={locale} bundle={bundle}>
            <Credits />
          </GameUiHost>
        </div>
      </div>
    </section>
  );
}
