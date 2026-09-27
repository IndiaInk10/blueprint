import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SteamLibrary } from './SteamLibrary';

const escape = (path: string) => path.replaceAll('\\', '\\\\');

describe('SteamLibrary', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'steam-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function setup(options: { listApp: boolean }) {
    const steamPath = join(root, 'Steam');
    const secondLibrary = join(root, 'SteamLibrary');
    await mkdir(join(steamPath, 'steamapps'), { recursive: true });
    await mkdir(join(secondLibrary, 'steamapps', 'common', 'Risk of Rain 2'), { recursive: true });

    await writeFile(
      join(steamPath, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders" {
        "0" { "path" "${escape(steamPath)}" "apps" { } }
        "1" { "path" "${escape(secondLibrary)}" "apps" { ${options.listApp ? '"632360" "1"' : ''} } }
      }`,
    );
    await writeFile(
      join(secondLibrary, 'steamapps', 'appmanifest_632360.acf'),
      '"AppState" { "appid" "632360" "installdir" "Risk of Rain 2" }',
    );
    return { steamPath, expected: join(secondLibrary, 'steamapps', 'common', 'Risk of Rain 2') };
  }

  it('finds an app installed in a secondary library', async () => {
    const { steamPath, expected } = await setup({ listApp: true });
    const library = await SteamLibrary.fromSteamPath(steamPath);
    expect(await library.findAppInstallDir(632360)).toBe(expected);
  });

  it('still finds the app when libraryfolders.vdf does not list it', async () => {
    const { steamPath, expected } = await setup({ listApp: false });
    const library = await SteamLibrary.fromSteamPath(steamPath);
    expect(await library.findAppInstallDir(632360)).toBe(expected);
  });

  it('returns null for apps that are not installed', async () => {
    const { steamPath } = await setup({ listApp: true });
    const library = await SteamLibrary.fromSteamPath(steamPath);
    expect(await library.findAppInstallDir(730)).toBeNull();
  });
});
