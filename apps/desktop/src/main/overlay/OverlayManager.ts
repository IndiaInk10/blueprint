import type { BrowserWindow, IpcMainEvent } from 'electron';
import type { Logger } from '@guide/sdk';
import { areKeysDown } from '@guide/overlay-native';
import { IpcChannel, type OverlayStatus, type OverlayTestResult, type PanelRegistration } from '../../shared/ipc';
import { isOverlayEnabledFor, isPanelAlwaysShown, isPanelEnabled } from '../../shared/settings';
import type { GameRegistry } from '../core/GameRegistry';
import { HotkeyService } from '../core/HotkeyService';
import type { SettingsStore } from '../core/SettingsStore';
import type { TrustedIpc } from '../ui/trustedIpc';
import { isPanelRegistration, PanelVisibility } from './PanelVisibility';
import { WindowBackend, type GameWindowState } from './WindowBackend';

const MAX_PANELS = 32;
const TRACK_RETRY_MS = 1000;
/** How long the settings screen's test button shows the panels. */
const TEST_DURATION_MS = 10_000;

const INITIAL_WINDOW_STATE: GameWindowState = { focused: false, minimized: false, hasBounds: false, destroyed: false };

interface Attachment {
  gameId: string;
  pid: number;
  backend: WindowBackend;
}

/**
 * Shows the overlay automatically while a running game is focused, unless the user turned it off
 * in settings (globally, per game or per panel). One game is overlaid at a time.
 */
export class OverlayManager {
  private readonly running = new Map<string, number>();
  private current: Attachment | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private gameWindow = INITIAL_WINDOW_STATE;
  private panels = new PanelVisibility();
  /** As the overlay page registered them, before settings overrides. */
  private registrations: PanelRegistration[] = [];
  private lastHotkeyAt: number | null = null;
  private testUntil: number | null = null;
  private testTimer: NodeJS.Timeout | null = null;
  private readonly hotkeys = new HotkeyService(areKeysDown, (held) => {
    if (held.size > 0) this.lastHotkeyAt = Date.now();
    this.panels.setHeld(held);
    this.render();
  });

  constructor(
    private readonly registry: GameRegistry,
    private readonly settings: SettingsStore,
    private readonly preloadPath: string,
    private readonly loadOverlayPage: (window: BrowserWindow, gameId: string) => void,
    private readonly log: Logger,
    ipc: TrustedIpc,
  ) {
    ipc.on(IpcChannel.OverlayRegisterPanels, (event, payload) => this.handleRegister(event, payload));
  }

  gameStarted(gameId: string, pid: number): void {
    this.running.set(gameId, pid);
    this.sync();
  }

  gameStopped(gameId: string): void {
    this.running.delete(gameId);
    this.sync();
  }

  /** Call after any settings change so switches apply to a game that is already running. */
  settingsChanged(): void {
    this.sync();
    this.applyRegistrations();
    this.render();
  }

  /**
   * Shows every enabled panel for a few seconds over the game window, whether or not the game is
   * in front or a hotkey is held, so the user can check placement and content.
   */
  test(gameId: string): OverlayTestResult {
    if (!this.running.has(gameId)) return 'not-running';
    if (!this.canOverlay(gameId)) return 'disabled';
    const current = this.current;
    if (current?.gameId !== gameId || !this.gameWindow.hasBounds) return 'no-window';
    if (this.testTimer) clearTimeout(this.testTimer);
    this.testUntil = Date.now() + TEST_DURATION_MS;
    this.testTimer = setTimeout(() => this.endTest(), TEST_DURATION_MS);
    this.render();
    return 'started';
  }

  /** The game's window handle while it is tracked and in front, else null. */
  focusedWindow(gameId: string): number | null {
    const current = this.current;
    if (current?.gameId !== gameId) return null;
    const { focused, minimized, hasBounds } = this.gameWindow;
    return focused && !minimized && hasBounds ? current.backend.trackedWindow : null;
  }

  status(gameId: string): OverlayStatus {
    const attached = this.current?.gameId === gameId;
    return {
      running: this.running.has(gameId),
      tracking: attached && this.gameWindow.hasBounds,
      gameFocused: attached && this.gameWindow.focused,
      lastHotkeyAt: attached ? this.lastHotkeyAt : null,
      testUntil: attached ? this.testUntil : null,
    };
  }

  private endTest(): void {
    if (this.testTimer) clearTimeout(this.testTimer);
    this.testTimer = null;
    this.testUntil = null;
    this.render();
  }

  dispose(): void {
    this.running.clear();
    this.detachCurrent();
  }

  private canOverlay(gameId: string): boolean {
    const manifest = this.registry.get(gameId)?.manifest;
    return !!manifest?.overlay.backends.includes('window') && isOverlayEnabledFor(this.settings.get(), gameId);
  }

  private sync(): void {
    const current = this.current;
    if (current && (this.running.get(current.gameId) !== current.pid || !this.canOverlay(current.gameId))) {
      this.detachCurrent();
    }
    if (this.current) return;
    for (const [gameId, pid] of this.running) {
      if (this.canOverlay(gameId)) {
        this.attach(gameId, pid);
        return;
      }
    }
  }

  private attach(gameId: string, pid: number): void {
    const backend = new WindowBackend(
      this.preloadPath,
      (window) => this.loadOverlayPage(window, gameId),
      (state) => this.handleGameWindow(state),
    );
    this.current = { gameId, pid, backend };
    this.tryTrack();
  }

  private detachCurrent(): void {
    const current = this.current;
    if (!current) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.hotkeys.setActive(false);
    this.hotkeys.setBindings([]);
    current.backend.dispose();
    this.current = null;
    this.gameWindow = INITIAL_WINDOW_STATE;
    this.panels = new PanelVisibility();
    this.registrations = [];
    this.lastHotkeyAt = null;
    this.endTest();
    this.log.info('Overlay detached', { gameId: current.gameId });
  }

  /** The game may not have created its window yet right after the process starts. */
  private tryTrack(): void {
    const current = this.current;
    if (!current) return;
    if (current.backend.attach(current.pid)) {
      this.log.info('Overlay tracking game window', { gameId: current.gameId, pid: current.pid });
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.tryTrack();
    }, TRACK_RETRY_MS);
  }

  private handleGameWindow(state: GameWindowState): void {
    const current = this.current;
    if (!current) return;
    this.gameWindow = state;

    if (state.destroyed) {
      // Games can recreate their window, e.g. when switching display modes.
      current.backend.detachTracking();
      this.tryTrack();
    }
    this.updateHotkeyPolling();
    this.render();
  }

  private handleRegister(event: IpcMainEvent, payload: unknown): void {
    const current = this.current;
    if (!current || event.sender !== current.backend.window.webContents) return;
    this.registrations = Array.isArray(payload) ? payload.filter(isPanelRegistration).slice(0, MAX_PANELS) : [];
    this.applyRegistrations();
    this.render();
  }

  /**
   * Applies the user's choice per panel: always shown (pinned) or only while its hotkey is held.
   * Only panels that declare a hotkey can be switched to hold-to-show.
   */
  private applyRegistrations(): void {
    const current = this.current;
    if (!current) return;
    const settings = this.settings.get();
    this.panels.setPanels(
      this.registrations.map((panel): PanelRegistration => {
        const always = isPanelAlwaysShown(settings, current.gameId, panel.panelId, panel.visibility === 'pinned');
        if (always) return { panelId: panel.panelId, visibility: 'pinned' };
        if (panel.visibility === 'pinned' && panel.keys?.length) return { ...panel, visibility: 'hold-hotkey' };
        return panel;
      }),
    );
    this.hotkeys.setBindings(this.panels.hotkeyBindings());
    this.updateHotkeyPolling();
  }

  /** Key polling only runs while the game is focused and some panel actually uses a hotkey. */
  private updateHotkeyPolling(): void {
    const { focused, minimized } = this.gameWindow;
    this.hotkeys.setActive(focused && !minimized && this.panels.hotkeyBindings().length > 0);
  }

  private render(): void {
    const current = this.current;
    if (!current) return;

    const settings = this.settings.get();
    const enabled = (panelId: string) => isPanelEnabled(settings, current.gameId, panelId);
    const testing = this.testUntil !== null;
    const panelIds = testing
      ? this.registrations.map((panel) => panel.panelId).filter(enabled)
      : this.panels.visible(enabled);
    const { window } = current.backend;
    if (!window.isDestroyed()) window.webContents.send(IpcChannel.OverlayVisiblePanels, panelIds);

    const { focused, minimized, hasBounds } = this.gameWindow;
    // A test shows even while this app is in front, so the user can switch to the game and look.
    current.backend.setVisible(panelIds.length > 0 && (focused || testing) && !minimized && hasBounds);
  }
}
