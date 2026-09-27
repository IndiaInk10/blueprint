import { createHash } from 'node:crypto';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Logger } from '@guide/sdk';

const USER_AGENT = 'Blueprint/0.1 (desktop game guide; image cache)';
const MAX_BYTES = 4 * 1024 * 1024;
const FAILURE_BACKOFF_MS = 10 * 60 * 1000;
// SVG is safe here: it is only ever shown through <img>, where scripts do not run.
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Images someone is looking at go first; background prefetching only fills spare capacity. */
export type AssetPriority = 'visible' | 'prefetch';

interface Ticket {
  priority: AssetPriority;
  /** Set while the download waits for a slot. */
  wake?: () => void;
}

/**
 * Downloads remote images once and serves them from disk afterwards. Images come from third-party
 * hosts (e.g. a game wiki), so downloads are few at a time, honour rate limiting, and a failure is
 * not retried for a while.
 */
export class AssetCache {
  private readonly pending = new Map<string, { ticket: Ticket; done: Promise<string | null> }>();
  private readonly failedUntil = new Map<string, number>();
  private active = 0;
  private activePrefetch = 0;
  private readonly waiting: Record<AssetPriority, Ticket[]> = { visible: [], prefetch: [] };

  constructor(
    private readonly dir: string,
    private readonly log: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly maxConcurrent = 4,
    /** Prefetching never takes every slot, so a visible image never waits behind a whole batch. */
    private readonly maxPrefetch = Math.max(1, maxConcurrent - 2),
  ) {}

  /** The first candidate that can be had, e.g. a thumbnail and then the original. */
  async getFirst(urls: string | readonly string[], priority: AssetPriority = 'visible'): Promise<string | null> {
    for (const url of typeof urls === 'string' ? [urls] : urls) {
      const file = await this.get(url, priority);
      if (file) return file;
    }
    return null;
  }

  /** Local file for the remote image, downloading it on first use. Null when it cannot be had. */
  async get(url: string, priority: AssetPriority = 'visible'): Promise<string | null> {
    const extension = extname(new URL(url).pathname).toLowerCase();
    const name = createHash('sha256').update(url).digest('hex').slice(0, 32);
    const file = join(this.dir, name + (ALLOWED_EXTENSIONS.has(extension) ? extension : '.img'));
    if (await exists(file)) return file;
    if ((this.failedUntil.get(url) ?? 0) > Date.now()) return null;

    const running = this.pending.get(url);
    if (running) {
      if (priority === 'visible') this.promote(running.ticket);
      return running.done;
    }
    const ticket: Ticket = { priority };
    const done = this.download(url, file, ticket).finally(() => this.pending.delete(url));
    this.pending.set(url, { ticket, done });
    return done;
  }

  private async download(url: string, file: string, ticket: Ticket): Promise<string | null> {
    await this.acquire(ticket);
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await this.fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
        if (!response || response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response?.headers.get('retry-after'));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
          continue;
        }
        const type = response.headers.get('content-type') ?? '';
        if (!response.ok || !type.startsWith('image/')) break;
        const body = Buffer.from(await response.arrayBuffer());
        if (body.length === 0 || body.length > MAX_BYTES) break;

        await mkdir(this.dir, { recursive: true });
        const temp = `${file}.${process.pid}.tmp`;
        await writeFile(temp, body);
        await rename(temp, file);
        return file;
      }
    } catch (error) {
      this.log.warn('Image download failed', { url, error: String(error) });
    } finally {
      this.release(ticket);
    }
    this.failedUntil.set(url, Date.now() + FAILURE_BACKOFF_MS);
    this.log.warn('Image unavailable, will retry later', { url });
    return null;
  }

  private canStart(priority: AssetPriority): boolean {
    return this.active < this.maxConcurrent && (priority === 'visible' || this.activePrefetch < this.maxPrefetch);
  }

  private take(ticket: Ticket): void {
    this.active++;
    if (ticket.priority === 'prefetch') this.activePrefetch++;
  }

  private async acquire(ticket: Ticket): Promise<void> {
    if (this.canStart(ticket.priority)) {
      this.take(ticket);
      return;
    }
    // pump() takes the slot on the ticket's behalf before waking it.
    await new Promise<void>((resolve) => {
      ticket.wake = resolve;
      this.waiting[ticket.priority].push(ticket);
    });
  }

  private release(ticket: Ticket): void {
    this.active--;
    if (ticket.priority === 'prefetch') this.activePrefetch--;
    this.pump();
  }

  /** Someone is now looking at an image that was only being prefetched: move it to the front lane. */
  private promote(ticket: Ticket): void {
    if (ticket.priority === 'visible') return;
    const index = this.waiting.prefetch.indexOf(ticket);
    if (index === -1) return; // Already downloading.
    this.waiting.prefetch.splice(index, 1);
    ticket.priority = 'visible';
    this.waiting.visible.push(ticket);
    this.pump();
  }

  private pump(): void {
    // Waiting visible images always go before prefetching.
    for (const lane of ['visible', 'prefetch'] as const) {
      while (this.waiting[lane].length > 0 && this.canStart(lane)) {
        const ticket = this.waiting[lane].shift()!;
        this.take(ticket);
        ticket.wake?.();
      }
    }
  }
}
