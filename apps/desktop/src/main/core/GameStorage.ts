import type { KeyValueStorage, Logger } from '@guide/sdk';
import { JsonFile } from './JsonFile';

/** Per-game key-value storage backed by one JSON file. */
export class GameStorage implements KeyValueStorage {
  private readonly file: JsonFile;
  private readonly values: Record<string, unknown>;

  constructor(filePath: string, log: Logger) {
    this.file = new JsonFile(filePath, log);
    const stored = this.file.read();
    this.values = typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? { ...stored } : {};
  }

  get(key: string): unknown {
    return this.values[key];
  }

  set(key: string, value: unknown): void {
    if (value === undefined) delete this.values[key];
    else this.values[key] = value;
    this.file.write(this.values);
  }
}
