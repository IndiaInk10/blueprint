import { mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Logger } from '@guide/sdk';

/**
 * A small JSON file read once at startup and rewritten on change.
 * Writes are serialized and go through a temp file, so a crash never leaves a half-written file.
 */
export class JsonFile {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    readonly path: string,
    private readonly log: Logger,
  ) {}

  /** Undefined when the file is missing or unreadable. */
  read(): unknown {
    let text: string;
    try {
      text = readFileSync(this.path, 'utf8');
    } catch {
      return undefined;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      this.log.warn('Ignoring corrupt JSON file', { path: this.path, error: String(error) });
      return undefined;
    }
  }

  write(value: unknown): void {
    const text = JSON.stringify(value, null, 2);
    const tempPath = `${this.path}.tmp`;
    this.writeQueue = this.writeQueue
      .then(async () => {
        mkdirSync(dirname(this.path), { recursive: true });
        await writeFile(tempPath, text, 'utf8');
        await rename(tempPath, this.path);
      })
      .catch((error: unknown) => this.log.error('Failed to write JSON file', { path: this.path, error: String(error) }));
  }
}
