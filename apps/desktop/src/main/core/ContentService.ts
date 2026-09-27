import type { AnyGameMainModule, ContentBundle, ContentMeta, Locale, Logger, MainHost } from '@guide/sdk';

/**
 * Where raw content documents come from. Today only the bundled source exists; a remote source
 * (CDN manifest + hash check + disk cache) or a database slots in ahead of it without touching
 * the modules. A source whose content fails validation — including content written for a newer
 * app (higher schemaVersion) — is skipped in favour of the next one.
 */
export interface ContentSource {
  readonly id: string;
  /** Raw documents, or null when this source has nothing for the game. */
  load(gameId: string, module: AnyGameMainModule): Promise<unknown>;
}

export const bundledContentSource: ContentSource = {
  id: 'bundled',
  load: async (_gameId, module) => module.content?.bundled() ?? null,
};

interface Parsed {
  content: unknown;
  meta: ContentMeta;
  source: string;
}

export class ContentService {
  private readonly parsed = new Map<string, Promise<Parsed | null>>();

  constructor(
    private readonly sources: ContentSource[],
    private readonly moduleFor: (gameId: string) => AnyGameMainModule | undefined,
    private readonly hostFor: (gameId: string) => MainHost,
    private readonly log: Logger,
  ) {}

  /** Null when the game has no content or no source produced valid content. */
  async get(gameId: string, locale: Locale): Promise<ContentBundle | null> {
    const module = this.moduleFor(gameId);
    if (!module?.content) return null;

    const parsed = await this.parsedContent(gameId, module);
    if (!parsed) return null;
    const strings = (await module.content.strings?.(parsed.content, locale, this.hostFor(gameId))) ?? {};
    return { ...parsed, strings };
  }

  /** Validated content without display strings, e.g. to resolve image URLs. */
  async content(gameId: string): Promise<unknown> {
    const module = this.moduleFor(gameId);
    if (!module?.content) return null;
    return (await this.parsedContent(gameId, module))?.content ?? null;
  }

  /** Forget cached content, e.g. after a remote source publishes a new version. */
  invalidate(gameId: string): void {
    this.parsed.delete(gameId);
  }

  private parsedContent(gameId: string, module: AnyGameMainModule): Promise<Parsed | null> {
    let pending = this.parsed.get(gameId);
    if (!pending) {
      pending = this.loadFirstValid(gameId, module);
      this.parsed.set(gameId, pending);
    }
    return pending;
  }

  private async loadFirstValid(gameId: string, module: AnyGameMainModule): Promise<Parsed | null> {
    const provider = module.content!;
    for (const source of this.sources) {
      try {
        const raw = await source.load(gameId, module);
        if (raw === null || raw === undefined) continue;
        const content = provider.parse(raw);
        const meta = provider.meta(content);
        this.log.info('Content loaded', { gameId, source: source.id, ...meta });
        return { content, meta, source: source.id };
      } catch (error) {
        // An invalid source must never take the app down: fall through to the next one.
        this.log.error('Content source rejected', { gameId, source: source.id, error: String(error) });
      }
    }
    return null;
  }
}
