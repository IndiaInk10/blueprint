import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrowserWindow } from 'electron';

export type AppPage = 'index' | 'overlay';

/**
 * Decides where the renderer pages come from, and which URLs are trusted to use the preload API.
 *
 * Today the UI ships with the app. To host it remotely later, add a RemoteUiSource that loads
 * `<baseUrl>/<page>.html`, falls back to the bundled source on `did-fail-load`, and trusts both
 * origins. Nothing else needs to change: pages only talk to the main process through the
 * preload API, and every IPC handler checks `isTrustedUrl` on the sender.
 */
export interface UiSource {
  load(window: BrowserWindow, page: AppPage, query?: Record<string, string>): void;
  isTrustedUrl(url: string): boolean;
}

export class BundledUiSource implements UiSource {
  private readonly devOrigin: string | null;
  private readonly rendererDirUrl: string;

  constructor(
    private readonly rendererDir: string,
    private readonly devServerUrl: string | null,
  ) {
    this.devOrigin = devServerUrl ? new URL(devServerUrl).origin : null;
    this.rendererDirUrl = pathToFileURL(rendererDir).href.toLowerCase() + '/';
  }

  load(window: BrowserWindow, page: AppPage, query: Record<string, string> = {}): void {
    if (this.devServerUrl) {
      void window.loadURL(`${this.devServerUrl}/${page}.html?${new URLSearchParams(query)}`);
    } else {
      void window.loadFile(join(this.rendererDir, `${page}.html`), { query });
    }
  }

  isTrustedUrl(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (this.devOrigin) return parsed.origin === this.devOrigin;
    // Windows paths are case-insensitive.
    return parsed.protocol === 'file:' && parsed.href.toLowerCase().startsWith(this.rendererDirUrl);
  }
}
