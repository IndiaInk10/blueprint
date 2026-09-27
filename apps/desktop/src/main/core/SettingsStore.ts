import type { Logger } from '@guide/sdk';
import { applySettingsUpdate, normalizeSettings, type Settings, type SettingsUpdate } from '../../shared/settings';
import { JsonFile } from './JsonFile';

export class SettingsStore {
  private readonly file: JsonFile;
  private current: Settings;

  constructor(filePath: string, log: Logger) {
    this.file = new JsonFile(filePath, log);
    this.current = normalizeSettings(this.file.read());
  }

  get(): Settings {
    return this.current;
  }

  update(update: SettingsUpdate): Settings {
    this.current = applySettingsUpdate(this.current, update);
    this.file.write(this.current);
    return this.current;
  }
}
