import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { Logger } from '@guide/sdk';

export const APP_NAME = 'Blueprint';

/** Data the app writes itself; Chromium's own caches are left behind and rebuilt. */
const OWN_DATA = ['settings.json', 'games', 'asset-cache'];

/**
 * Names the app (which also decides the user-data folder, %APPDATA%\Blueprint) and, on the first
 * run under that name, copies settings and caches over from the folder used before the rename.
 * Must run before anything reads app.getPath('userData').
 */
export function applyAppIdentity(log: Logger): void {
  app.setName(APP_NAME);
  const current = app.getPath('userData');
  const legacy = join(app.getPath('appData'), '@guide', 'desktop');
  if (!existsSync(legacy) || existsSync(join(current, 'settings.json'))) return;

  for (const entry of OWN_DATA) {
    const from = join(legacy, entry);
    if (!existsSync(from)) continue;
    try {
      cpSync(from, join(current, entry), { recursive: true, errorOnExist: false, force: false });
    } catch (error) {
      log.warn('Could not copy data from the previous app folder', { entry, error: String(error) });
    }
  }
  log.info('Copied data from the previous app folder', { from: legacy, to: current });
}
