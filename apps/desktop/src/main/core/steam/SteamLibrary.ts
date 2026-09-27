import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { promisify } from 'node:util';
import type { Logger } from '@guide/sdk';
import type { LibraryArtKind } from '../../../shared/steamArt';
import { parseVdf, vdfObject, vdfString } from './vdf';

const execFileAsync = promisify(execFile);

const DEFAULT_STEAM_PATH = 'C:\\Program Files (x86)\\Steam';

const ART_FILE_NAMES: Record<Exclude<LibraryArtKind, 'icon'>, string> = {
  hero: 'library_hero.jpg',
  logo: 'logo.png',
  capsule: 'library_600x900.jpg',
  header: 'library_header.jpg',
};
/** The small library icon is stored under its content hash. */
const ICON_FILE_PATTERN = /^[0-9a-f]{40}\.jpg$/;

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readSteamPathFromRegistry(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
      windowsHide: true,
    });
    const match = /SteamPath\s+REG_SZ\s+(.+)/.exec(stdout);
    return match ? normalize(match[1]!.trim()) : null;
  } catch {
    return null;
  }
}

interface LibraryFolder {
  path: string;
  appIds: Set<string>;
}

export class SteamLibrary {
  private constructor(
    readonly steamPath: string,
    private readonly folders: LibraryFolder[],
  ) {}

  /** Returns null when Steam is not installed or its library list cannot be read. */
  static async locate(log: Logger): Promise<SteamLibrary | null> {
    const candidates = [await readSteamPathFromRegistry(), DEFAULT_STEAM_PATH].filter((p): p is string => !!p);
    for (const steamPath of candidates) {
      if (!(await isDirectory(steamPath))) continue;
      try {
        const library = await SteamLibrary.fromSteamPath(steamPath);
        log.info('Steam located', { steamPath, libraries: library.folders.map((f) => f.path) });
        return library;
      } catch (error) {
        log.warn('Failed to read Steam library folders', { steamPath, error: String(error) });
      }
    }
    log.warn('Steam not found');
    return null;
  }

  static async fromSteamPath(steamPath: string): Promise<SteamLibrary> {
    const text = await readFile(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    const entries = vdfObject(parseVdf(text)['libraryfolders']) ?? {};
    const folders: LibraryFolder[] = [];
    for (const entry of Object.values(entries)) {
      const folder = vdfObject(entry);
      const path = vdfString(folder?.['path']);
      if (!folder || !path) continue;
      folders.push({ path: normalize(path), appIds: new Set(Object.keys(vdfObject(folder['apps']) ?? {})) });
    }
    return new SteamLibrary(steamPath, folders);
  }

  /** Absolute install directory of the app, or null when it is not installed. */
  async findAppInstallDir(appId: number): Promise<string | null> {
    const id = String(appId);
    // Folders that list the app come first, but every folder is checked since the list can be stale.
    const ordered = [...this.folders].sort((a, b) => Number(b.appIds.has(id)) - Number(a.appIds.has(id)));
    for (const folder of ordered) {
      const steamapps = join(folder.path, 'steamapps');
      let manifestText: string;
      try {
        manifestText = await readFile(join(steamapps, `appmanifest_${id}.acf`), 'utf8');
      } catch {
        continue;
      }
      const installdir = vdfString(vdfObject(parseVdf(manifestText)['AppState'])?.['installdir']);
      if (!installdir) continue;
      const dir = join(steamapps, 'common', installdir);
      if (await isDirectory(dir)) return dir;
    }
    return null;
  }

  /**
   * Path of a cached library image, or null when Steam has not downloaded it.
   * Newer Steam clients keep some images one directory deeper, under a hash-named folder.
   */
  async findLibraryArt(appId: number, kind: LibraryArtKind): Promise<string | null> {
    const root = join(this.steamPath, 'appcache', 'librarycache', String(appId));
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      return null;
    }

    const matches = (name: string) => (kind === 'icon' ? ICON_FILE_PATTERN.test(name) : name === ART_FILE_NAMES[kind]);
    const direct = entries.find((entry) => entry.isFile() && matches(entry.name));
    if (direct) return join(root, direct.name);
    if (kind === 'icon') return null;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = join(root, entry.name, ART_FILE_NAMES[kind]);
      try {
        if ((await stat(candidate)).isFile()) return candidate;
      } catch {
        // Not in this folder.
      }
    }
    return null;
  }
}
