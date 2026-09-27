import { describe, expect, it } from 'vitest';
import {
  applySettingsUpdate,
  defaultSettings,
  isOverlayEnabledFor,
  isPanelAlwaysShown,
  isPanelEnabled,
  isSettingsUpdate,
  normalizeSettings,
  resolveLocale,
} from './settings';

describe('settings', () => {
  it('defaults everything to enabled', () => {
    const settings = defaultSettings();
    expect(isOverlayEnabledFor(settings, 'ror2')).toBe(true);
    expect(isPanelEnabled(settings, 'ror2', 'build-tree')).toBe(true);
  });

  it('applies global, per-game and per-panel switches', () => {
    let settings = defaultSettings();
    settings = applySettingsUpdate(settings, { type: 'overlay.panel.enabled', gameId: 'ror2', panelId: 'build-tree', enabled: false });
    expect(isPanelEnabled(settings, 'ror2', 'build-tree')).toBe(false);
    expect(isPanelEnabled(settings, 'ror2', 'other')).toBe(true);

    settings = applySettingsUpdate(settings, { type: 'overlay.game.enabled', gameId: 'ror2', enabled: false });
    expect(isOverlayEnabledFor(settings, 'ror2')).toBe(false);
    expect(isOverlayEnabledFor(settings, 'other-game')).toBe(true);
    // Turning the game off keeps its panel choices.
    expect(isPanelEnabled(settings, 'ror2', 'build-tree')).toBe(false);

    settings = applySettingsUpdate(settings, { type: 'overlay.game.enabled', gameId: 'ror2', enabled: true });
    settings = applySettingsUpdate(settings, { type: 'overlay.enabled', enabled: false });
    expect(isOverlayEnabledFor(settings, 'ror2')).toBe(false);
  });

  it('does not mutate the previous object', () => {
    const before = defaultSettings();
    applySettingsUpdate(before, { type: 'overlay.game.enabled', gameId: 'ror2', enabled: false });
    expect(before).toEqual(defaultSettings());
  });

  it('validates updates coming over IPC', () => {
    expect(isSettingsUpdate({ type: 'overlay.enabled', enabled: false })).toBe(true);
    expect(isSettingsUpdate({ type: 'overlay.panel.enabled', gameId: 'ror2', panelId: 'x', enabled: true })).toBe(true);
    expect(isSettingsUpdate({ type: 'overlay.enabled', enabled: 'no' })).toBe(false);
    expect(isSettingsUpdate({ type: 'overlay.game.enabled', enabled: true })).toBe(false);
    expect(isSettingsUpdate({ type: 'unknown', enabled: true })).toBe(false);
  });

  it('normalizes whatever was on disk', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings());
    expect(
      normalizeSettings({
        overlay: { enabled: false, games: { ror2: { enabled: 'x', panels: { a: false, b: 1 } }, bad: 3 } },
      }),
    ).toEqual({
      ...defaultSettings(),
      overlay: { enabled: false, games: { ror2: { panels: { a: false } } } },
    });
    expect(normalizeSettings({ ui: { locale: 'en' } }).ui.locale).toBe('en');
    expect(normalizeSettings({ ui: { locale: 'fr' } }).ui.locale).toBe('system');
  });

  it('switches the UI language', () => {
    const settings = applySettingsUpdate(defaultSettings(), { type: 'ui.locale', locale: 'en' });
    expect(settings.ui.locale).toBe('en');
    expect(isSettingsUpdate({ type: 'ui.locale', locale: 'ko' })).toBe(true);
    expect(isSettingsUpdate({ type: 'ui.locale', locale: 'de' })).toBe(false);
  });

  it('resolves "system" from the OS language', () => {
    expect(resolveLocale('system', 'ko-KR')).toBe('ko');
    expect(resolveLocale('system', 'en-US')).toBe('en');
    expect(resolveLocale('system', 'ja-JP')).toBe('en');
    expect(resolveLocale('ko', 'en-US')).toBe('ko');
  });
});

describe('always-show override', () => {
  it('is stored per panel and survives a round trip', () => {
    const next = applySettingsUpdate(defaultSettings(), { type: 'overlay.panel.alwaysShow', gameId: 'g', panelId: 'p', enabled: true });
    expect(isPanelAlwaysShown(next, 'g', 'p', false)).toBe(true);
    expect(isPanelAlwaysShown(next, 'g', 'other', false)).toBe(false);
    expect(isPanelAlwaysShown(next, 'g', 'other', true)).toBe(true);
    expect(isPanelAlwaysShown(normalizeSettings(JSON.parse(JSON.stringify(next))), 'g', 'p', false)).toBe(true);
    const hotkeyOnly = applySettingsUpdate(next, { type: 'overlay.panel.alwaysShow', gameId: 'g', panelId: 'p', enabled: false });
    expect(isPanelAlwaysShown(hotkeyOnly, 'g', 'p', true)).toBe(false);
    expect(isSettingsUpdate({ type: 'overlay.panel.alwaysShow', gameId: 'g', panelId: 'p', enabled: true })).toBe(true);
  });
});

describe('startup settings', () => {
  it('defaults to staying in the tray without starting with Windows', () => {
    expect(defaultSettings().startup).toEqual({ launchAtLogin: false, startHidden: true, closeToTray: true });
  });

  it('updates, validates and round-trips each switch', () => {
    const next = applySettingsUpdate(defaultSettings(), { type: 'startup.launchAtLogin', enabled: true });
    expect(next.startup.launchAtLogin).toBe(true);
    expect(isSettingsUpdate({ type: 'startup.closeToTray', enabled: false })).toBe(true);
    expect(isSettingsUpdate({ type: 'startup.closeToTray' })).toBe(false);
    expect(normalizeSettings(JSON.parse(JSON.stringify(next))).startup.launchAtLogin).toBe(true);
    expect(normalizeSettings({ startup: { closeToTray: 'yes' } }).startup.closeToTray).toBe(true);
  });
});
