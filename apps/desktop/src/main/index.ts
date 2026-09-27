import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, net, protocol, shell } from 'electron';
import type { GameContentProvider, Locale, MainHost, ScreenRegionSpec } from '@guide/sdk';
import { readScreenText } from '@guide/overlay-native';
import { GAME_ASSET_SCHEME, parseGameAssetUrl } from '../shared/gameAsset';
import { IpcChannel, type GameStatus } from '../shared/ipc';
import { isSettingsUpdate, resolveLocale } from '../shared/settings';
import { isLibraryArtKind, STEAM_ART_HOST, STEAM_ART_SCHEME } from '../shared/steamArt';
import { applyAppIdentity } from './core/appIdentity';
import { AssetCache } from './core/AssetCache';
import { bundledContentSource, ContentService } from './core/ContentService';
import { GameDetector } from './core/GameDetector';
import { GameRegistry } from './core/GameRegistry';
import { GameStorage } from './core/GameStorage';
import { createLogger } from './core/log';
import { nativeProcessSource } from './core/nativeProcessSource';
import { SessionManager } from './core/SessionManager';
import { SettingsStore } from './core/SettingsStore';
import { SteamLibrary } from './core/steam/SteamLibrary';
import { games } from './games';
import { OverlayManager } from './overlay/OverlayManager';
import { TrustedIpc } from './ui/trustedIpc';
import { applyLaunchAtLogin, createTray, startedHidden } from './shell';
import { BundledUiSource } from './ui/UiSource';

const log = createLogger('core');
// Before anything touches app.getPath('userData').
applyAppIdentity(log);

// One Blueprint at a time: starting it again (or Windows starting it while it runs) shows the
// existing window instead of a second copy with its own overlay.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', () => showMainWindow());
const preloadPath = join(__dirname, '../preload/index.js');
const iconPath = join(__dirname, '../../resources/icon.png');
const LOCALES: readonly Locale[] = ['ko', 'en'];

protocol.registerSchemesAsPrivileged([
  { scheme: STEAM_ART_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: GAME_ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const devServerUrl = !app.isPackaged ? (process.env['ELECTRON_RENDERER_URL'] ?? null) : null;
const ui = new BundledUiSource(join(__dirname, '../renderer'), devServerUrl);
const ipc = new TrustedIpc(ui, createLogger('ipc'));

const registry = new GameRegistry();
for (const game of games) registry.register(game);

const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'), createLogger('settings'));
const installDirs = new Map<string, string | null>();
let steam: Promise<SteamLibrary | null> = Promise.resolve(null);

const hosts = new Map<string, MainHost>();
/**
 * OCR on parts of a game's window. Only while the game is in front: the capture copies what is
 * on screen, which would otherwise be whatever window covers the game.
 */
async function readGameScreen(gameId: string, regions: ScreenRegionSpec[]): Promise<Record<string, string[]> | null> {
  const hwnd = overlay.focusedWindow(gameId);
  if (hwnd === null || regions.length === 0) return null;
  const lines = (await readScreenText(
    hwnd,
    regions.map(({ x, y, width, height, scale }) => ({ x, y, width, height, scale })),
  )) as string[][];
  return Object.fromEntries(regions.map((region, index) => [region.id, lines[index] ?? []]));
}

function hostFor(gameId: string): MainHost {
  let host = hosts.get(gameId);
  if (!host) {
    const gameLog = createLogger(gameId);
    host = {
      log: gameLog,
      storage: new GameStorage(join(app.getPath('userData'), 'games', `${gameId}.json`), gameLog),
      installDir: () => installDirs.get(gameId) ?? null,
      readScreen: (regions) => readGameScreen(gameId, regions),
    };
    hosts.set(gameId, host);
  }
  return host;
}

const sessions = new SessionManager(
  registry,
  hostFor,
  (gameId) => broadcast(IpcChannel.StatusChanged, statusOf(gameId)),
  log,
);

const content = new ContentService([bundledContentSource], (gameId) => registry.get(gameId), hostFor, createLogger('content'));

const overlay = new OverlayManager(
  registry,
  settings,
  preloadPath,
  (window, gameId) => ui.load(window, 'overlay', { game: gameId }),
  createLogger('overlay'),
  ipc,
);

const detector = new GameDetector(
  registry.manifests(),
  nativeProcessSource,
  (event) => {
    if (event.type === 'started') {
      sessions.start(event.gameId, event.pid);
      overlay.gameStarted(event.gameId, event.pid);
    } else {
      overlay.gameStopped(event.gameId);
      sessions.stop(event.gameId);
    }
  },
  log,
);

function statusOf(gameId: string): GameStatus {
  return { gameId, installDir: installDirs.get(gameId) ?? null, session: sessions.info(gameId) };
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

async function resolveInstallDirs(): Promise<void> {
  const library = await steam;
  for (const manifest of registry.manifests()) {
    const dir = library && manifest.steamAppId ? await library.findAppInstallDir(manifest.steamAppId) : null;
    installDirs.set(manifest.id, dir);
    log.info('Install dir resolved', { gameId: manifest.id, dir });
    broadcast(IpcChannel.StatusChanged, statusOf(manifest.id));
  }
}

/** Serves steam-art://library/<appId>/<kind> from the local Steam library cache. */
function registerSteamArtProtocol(): void {
  protocol.handle(STEAM_ART_SCHEME, async (request) => {
    const url = new URL(request.url);
    const [appIdText = '', kind = ''] = url.pathname.slice(1).split('/');
    const appId = Number(appIdText);
    const valid = url.hostname === STEAM_ART_HOST && Number.isInteger(appId) && appId > 0 && isLibraryArtKind(kind);
    const library = await steam;
    const path = valid && library ? await library.findLibraryArt(appId, kind) : null;
    return path ? net.fetch(pathToFileURL(path).toString()) : new Response(null, { status: 404 });
  });
}

/** A module's image URLs for one asset, keeping only https ones: modules never point the cache elsewhere. */
function remoteImageUrls(provider: GameContentProvider<unknown>, parsed: unknown, kind: string, id: string): string[] {
  const remote = provider.asset?.(parsed, kind, id) ?? [];
  return (typeof remote === 'string' ? [remote] : [...remote]).filter((url) => url.startsWith('https://'));
}

/**
 * Serves game-asset://<gameId>/<kind>/<id>: the game module maps it to a remote image, which is
 * downloaded once into the user's cache. Nothing is bundled with the app.
 */
function registerGameAssetProtocol(): AssetCache {
  const cache = new AssetCache(join(app.getPath('userData'), 'asset-cache'), createLogger('assets'));
  protocol.handle(GAME_ASSET_SCHEME, async (request) => {
    const asset = parseGameAssetUrl(request.url);
    const provider = asset ? registry.get(asset.gameId)?.content : undefined;
    if (!asset || !provider?.asset) return new Response(null, { status: 404 });

    const parsed = await content.content(asset.gameId);
    const remote = parsed === null ? [] : remoteImageUrls(provider, parsed, asset.kind, asset.id);
    const file = remote.length > 0 ? await cache.getFirst(remote) : null;
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response(null, { status: 404 });
  });
  return cache;
}

/** Wait before prefetching so startup and the first screen get the network and disk first. */
const PREFETCH_DELAY_MS = 4000;

/**
 * Downloads every image the games' content uses in the background, so a view shows its images
 * straight from disk the first time it opens. Images already cached cost one stat() each.
 */
async function prefetchGameAssets(cache: AssetCache): Promise<void> {
  const assetLog = createLogger('assets');
  for (const game of registry.list()) {
    const provider = game.content;
    if (!provider?.assets) continue;
    const parsed = await content.content(game.manifest.id);
    if (parsed === null) continue;
    const started = Date.now();
    const refs = provider.assets(parsed);
    const results = await Promise.all(
      refs.map(({ kind, id }) => {
        const remote = remoteImageUrls(provider, parsed, kind, id);
        return remote.length > 0 ? cache.getFirst(remote, 'prefetch') : Promise.resolve(null);
      }),
    );
    assetLog.info('Images ready', {
      gameId: game.manifest.id,
      ready: results.filter(Boolean).length,
      total: refs.length,
      ms: Date.now() - started,
    });
  }
}

let mainWindow: BrowserWindow | null = null;
/** Set once the user really quits; until then closing the window may only hide it. */
let quitting = false;

/** Brings the window back from the tray, creating it if it was never opened. */
function showMainWindow(): void {
  if (!app.isReady()) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(true);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(visible: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#1b2838',
    icon: iconPath,
    autoHideMenuBar: true,
    // No native title bar: the app's top bar is the drag region and the window buttons are drawn over it.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#171a21', symbolColor: '#8f98a0', height: 52 },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => {
    if (visible) window.show();
  });
  // Closing hides to the tray so the overlay keeps working; the tray menu quits for real.
  window.on('close', (event) => {
    if (quitting || !settings.get().startup.closeToTray) return;
    event.preventDefault();
    window.hide();
  });
  window.on('closed', () => {
    mainWindow = null;
    // Without the tray option, closing the window ends the app (the overlay window would keep it alive).
    if (!quitting) app.quit();
  });
  ui.load(window, 'index');
  return window;
}

// Pages may never navigate away from the trusted UI; links open in the user's browser instead.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!ui.isTrustedUrl(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
});

const isKnownGame = (gameId: unknown): gameId is string => typeof gameId === 'string' && !!registry.get(gameId);

ipc.handle(IpcChannel.ListGames, () => registry.manifests());
ipc.handle(IpcChannel.GetStatuses, () => registry.manifests().map((manifest) => statusOf(manifest.id)));
ipc.handle(IpcChannel.GetContent, (_event, gameId, locale) => {
  if (!isKnownGame(gameId) || !LOCALES.includes(locale as Locale)) throw new Error('Invalid content request');
  return content.get(gameId, locale as Locale);
});
ipc.handle(IpcChannel.InvokeAction, async (_event, gameId, action, payload) => {
  if (!isKnownGame(gameId) || typeof action !== 'string') throw new Error('Invalid action request');
  const handler = registry.get(gameId)?.actions?.[action];
  if (!handler) throw new Error(`Unknown action "${action}" for ${gameId}`);
  return handler(payload, {
    host: hostFor(gameId),
    updateState: (priority, patch) => sessions.applyPatch(gameId, priority, patch),
  });
});
ipc.handle(IpcChannel.GetSettings, () => settings.get());
ipc.handle(IpcChannel.OverlayTest, (_event, gameId) => {
  if (typeof gameId !== 'string' || !registry.get(gameId)) throw new Error('Unknown game');
  return overlay.test(gameId);
});
ipc.handle(IpcChannel.OverlayStatus, (_event, gameId) => {
  if (typeof gameId !== 'string' || !registry.get(gameId)) throw new Error('Unknown game');
  return overlay.status(gameId);
});
// The user's language list, not the Windows display language: they can differ (English Windows, Korean user).
ipc.handle(IpcChannel.GetSystemLanguage, () => app.getPreferredSystemLanguages()[0] ?? app.getLocale());
ipc.handle(IpcChannel.UpdateSettings, (_event, update) => {
  if (!isSettingsUpdate(update)) throw new Error('Invalid settings update');
  const next = settings.update(update);
  if (update.type === 'startup.launchAtLogin') applyLaunchAtLogin(next.startup.launchAtLogin, log);
  overlay.settingsChanged();
  broadcast(IpcChannel.SettingsChanged, next);
  return next;
});

void app.whenReady().then(() => {
  steam = SteamLibrary.locate(log);
  registerSteamArtProtocol();
  const assetCache = registerGameAssetProtocol();
  setTimeout(() => void prefetchGameAssets(assetCache), PREFETCH_DELAY_MS);
  // Keep Windows' startup entry in line with the setting (the app path may have moved).
  applyLaunchAtLogin(settings.get().startup.launchAtLogin, log);
  createTray(
    iconPath,
    () => resolveLocale(settings.get().ui.locale, app.getPreferredSystemLanguages()[0] ?? app.getLocale()),
    showMainWindow,
    () => app.quit(),
  );
  // Started with Windows: stay in the tray unless the user wants the window.
  const hidden = startedHidden() && settings.get().startup.startHidden;
  mainWindow = createMainWindow(!hidden);
  void resolveInstallDirs();
  detector.start();
  app.on('activate', () => showMainWindow());
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', () => {
  detector.stop();
  overlay.dispose();
  sessions.stopAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
