import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { Logger } from '@guide/sdk';
import type { UiSource } from './UiSource';

/**
 * IPC registration that ignores messages from frames the UI source does not trust.
 * Matters most once any UI is loaded from the network.
 */
export class TrustedIpc {
  constructor(
    private readonly ui: UiSource,
    private readonly log: Logger,
  ) {}

  private trusted(event: IpcMainEvent | IpcMainInvokeEvent, channel: string): boolean {
    const url = event.senderFrame?.url ?? '';
    if (this.ui.isTrustedUrl(url)) return true;
    this.log.warn('Rejected IPC from untrusted frame', { channel, url });
    return false;
  }

  handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!this.trusted(event, channel)) throw new Error('Untrusted sender');
      return handler(event, ...args);
    });
  }

  on(channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void): void {
    ipcMain.on(channel, (event, ...args: unknown[]) => {
      if (this.trusted(event, channel)) listener(event, ...args);
    });
  }
}
