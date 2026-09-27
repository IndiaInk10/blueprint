import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger } from '@guide/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetCache } from './AssetCache';

const silentLog: Logger = { info() {}, warn() {}, error() {} };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function respond(status: number, type = 'image/png', body: Uint8Array = PNG, headers: Record<string, string> = {}) {
  return new Response(status === 200 ? body : null, { status, headers: { 'content-type': type, ...headers } });
}

describe('AssetCache', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'assets-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('downloads once, shares concurrent requests, then serves from disk', async () => {
    let calls = 0;
    const cache = new AssetCache(dir, silentLog, (async () => {
      calls++;
      return respond(200);
    }) as typeof fetch);

    const url = 'https://example.com/images/Soldier%27s_Syringe.png';
    const [a, b] = await Promise.all([cache.get(url), cache.get(url)]);
    expect(a).toBe(b);
    expect(a).toMatch(/\.png$/);
    expect(new Uint8Array(await readFile(a!))).toEqual(PNG);
    expect(await cache.get(url)).toBe(a);
    expect(calls).toBe(1);
  });

  it('retries after rate limiting', async () => {
    const statuses = [429, 200];
    const cache = new AssetCache(dir, silentLog, (async () =>
      respond(statuses.shift()!, 'image/png', PNG, { 'retry-after': '0' })) as typeof fetch);
    expect(await cache.get('https://example.com/a.png')).not.toBeNull();
  });

  it('refuses non-images and does not retry them right away', async () => {
    let calls = 0;
    const cache = new AssetCache(dir, silentLog, (async () => {
      calls++;
      return respond(200, 'text/html', new TextEncoder().encode('<html>'));
    }) as typeof fetch);
    expect(await cache.get('https://example.com/a.png')).toBeNull();
    expect(await cache.get('https://example.com/a.png')).toBeNull();
    expect(calls).toBe(1);
  });

  it('limits concurrent downloads', async () => {
    let active = 0;
    let peak = 0;
    const cache = new AssetCache(
      dir,
      silentLog,
      (async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
        return respond(200);
      }) as typeof fetch,
      2,
    );
    await Promise.all(Array.from({ length: 6 }, (_, i) => cache.get(`https://example.com/${i}.png`)));
    expect(peak).toBe(2);
  });

  it('falls back to the next candidate', async () => {
    const cache = new AssetCache(dir, silentLog, (async (url: string) =>
      url.includes('/thumb/') ? respond(404, 'text/html') : respond(200)) as typeof fetch);
    const file = await cache.getFirst(['https://example.com/thumb/a.png/64px-a.png', 'https://example.com/a.png']);
    expect(file).toMatch(/\.png$/);
  });

  it('keeps slots free for visible images and lets them jump the prefetch queue', async () => {
    const order: string[] = [];
    const gates = new Map<string, () => void>();
    let openAll = false;
    const cache = new AssetCache(
      dir,
      silentLog,
      (async (url: string) => {
        order.push(url);
        if (!openAll) await new Promise<void>((resolve) => gates.set(url, resolve));
        return respond(200);
      }) as typeof fetch,
      3,
      1,
    );
    // Waits for downloads to start, then a little longer so an extra one would show up too.
    const started = async (count: number) => {
      for (let i = 0; i < 200 && order.length < count; i++) await new Promise((resolve) => setTimeout(resolve, 5));
      await new Promise((resolve) => setTimeout(resolve, 30));
    };
    const prefetched = Array.from({ length: 4 }, (_, i) => cache.get(`https://example.com/p${i}.png`, 'prefetch'));
    await started(1);
    // Only one prefetch runs; the other slots stay free.
    expect(order).toHaveLength(1);
    const first = order[0]!;
    // Someone scrolls to an image that is still queued for prefetch, and to a new one: both start right away.
    const queued = ['p0', 'p1', 'p2', 'p3'].map((p) => `https://example.com/${p}.png`).find((url) => url !== first)!;
    const promoted = cache.get(queued);
    const visible = cache.get('https://example.com/v.png');
    await started(3);
    expect(order).toHaveLength(3);
    expect(new Set(order.slice(1))).toEqual(new Set([queued, 'https://example.com/v.png']));

    openAll = true;
    for (const open of gates.values()) open();
    await Promise.all([...prefetched, visible, promoted]);
    expect(order).toHaveLength(5);
  });
});
