import { BrowserWindow, screen } from 'electron';
import { findMainWindow, startWindowTracking, stopWindowTracking, type WindowSnapshot } from '@guide/overlay-native';

export interface GameWindowState {
  focused: boolean;
  minimized: boolean;
  hasBounds: boolean;
  destroyed: boolean;
}

/**
 * Transparent, click-through, top-most window that follows the game's client area.
 * No injection: works for windowed and borderless games, not for exclusive fullscreen.
 * One instance per attachment; dispose() destroys the window so no renderer lingers between sessions.
 */
export class WindowBackend {
  readonly id = 'window';
  readonly window: BrowserWindow;
  private shown = false;
  private tracking = false;
  /** Handle of the followed game window, null while not tracking. */
  trackedWindow: number | null = null;

  constructor(
    preloadPath: string,
    loadPage: (window: BrowserWindow) => void,
    private readonly onGameWindowChange: (state: GameWindowState) => void,
  ) {
    this.window = new BrowserWindow({
      show: false,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      fullscreenable: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setIgnoreMouseEvents(true, { forward: true });
    loadPage(this.window);
  }

  /** Starts following the game's main window. Returns false when the game has no window yet. */
  attach(pid: number): boolean {
    const hwnd = findMainWindow(pid);
    if (hwnd === null) return false;
    startWindowTracking(hwnd, (snapshot) => this.handleSnapshot(snapshot));
    this.tracking = true;
    this.trackedWindow = hwnd;
    return true;
  }

  detachTracking(): void {
    if (!this.tracking) return;
    stopWindowTracking();
    this.tracking = false;
    this.trackedWindow = null;
  }

  setVisible(visible: boolean): void {
    if (visible === this.shown || this.window.isDestroyed()) return;
    this.shown = visible;
    if (visible) {
      // showInactive keeps keyboard focus in the game.
      this.window.showInactive();
      this.window.moveTop();
    } else {
      this.window.hide();
    }
  }

  dispose(): void {
    this.detachTracking();
    if (!this.window.isDestroyed()) this.window.destroy();
  }

  private handleSnapshot(snapshot: WindowSnapshot): void {
    if (this.window.isDestroyed()) return;
    if (snapshot.bounds) {
      // Native bounds are physical pixels; Electron positions windows in DIPs.
      this.window.setBounds(screen.screenToDipRect(null, snapshot.bounds));
    }
    // Re-assert z-order only when focus returns to the game; doing it on every move causes flicker.
    if (snapshot.reason === 'foreground' && snapshot.targetFocused && this.shown) this.window.moveTop();

    this.onGameWindowChange({
      focused: snapshot.targetFocused,
      minimized: snapshot.minimized,
      hasBounds: !!snapshot.bounds,
      destroyed: snapshot.reason === 'destroy',
    });
  }
}
