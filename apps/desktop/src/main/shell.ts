// How the app lives on the desktop: starting with Windows, the tray icon, and hiding instead of quitting.
import { app, Menu, nativeImage, Tray } from 'electron';
import type { Locale, Logger } from '@guide/sdk';

/** Passed when Windows starts the app at login, so it opens in the tray instead of on screen. */
export const HIDDEN_ARG = '--hidden';

export function startedHidden(): boolean {
  return process.argv.includes(HIDDEN_ARG);
}

/**
 * Registers or removes the app from Windows startup. Unpackaged runs register Electron with the
 * app folder, which starts the built app (out/), not the dev server.
 */
export function applyLaunchAtLogin(enabled: boolean, log: Logger): void {
  const args = app.isPackaged ? [HIDDEN_ARG] : [app.getAppPath(), HIDDEN_ARG];
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args });
  const registered = app.getLoginItemSettings({ path: process.execPath, args }).openAtLogin;
  if (registered !== enabled) log.warn('Windows startup entry did not change', { enabled, registered });
  else log.info('Windows startup entry', { enabled });
}

const LABELS: Record<Locale, { open: string; quit: string; tooltip: string }> = {
  ko: { open: 'Blueprint 열기', quit: '종료', tooltip: 'Blueprint' },
  en: { open: 'Open Blueprint', quit: 'Quit', tooltip: 'Blueprint' },
};

/** Tray icon: click opens the window, the menu opens it or quits for real. */
export function createTray(iconPath: string, locale: () => Locale, onOpen: () => void, onQuit: () => void): Tray {
  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  const refreshMenu = () => {
    const labels = LABELS[locale()];
    tray.setToolTip(labels.tooltip);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: labels.open, click: onOpen },
        { type: 'separator' },
        { label: labels.quit, click: onQuit },
      ]),
    );
  };
  refreshMenu();
  tray.on('click', onOpen);
  // The menu is rebuilt when opened so it follows a language change.
  tray.on('right-click', refreshMenu);
  return tray;
}
