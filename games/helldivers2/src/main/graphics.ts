// Lighting fix for Helldivers 2 under DX11, applied to the game's own settings file.
// Tuned on an RTX 3070 at 3440x1440: lights and the flashlight reach farther and fade naturally.
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface GraphicsTweak {
  key: string;
  value: number;
}

/**
 * - light_falloff_end_target: 45 by default and 10 after Lighting High; 3 is the fix. The game can
 *   reset it when the lighting quality or a preset changes, so it may need applying again.
 * - lighting_and_material_quality: 2 is Lighting Quality High.
 */
export const LIGHTING_TWEAKS: readonly GraphicsTweak[] = [
  { key: 'light_falloff_end_target', value: 3 },
  { key: 'lighting_and_material_quality', value: 2 },
];

const lineFor = (key: string) => new RegExp(`^(\\s*${key}\\s*=\\s*)([\\d.]+)`, 'm');

/** Current value of each tweak in the file's text; null when the key is missing. */
export function readTweaks(text: string, tweaks = LIGHTING_TWEAKS): Record<string, number | null> {
  return Object.fromEntries(
    tweaks.map(({ key }) => {
      const match = lineFor(key).exec(text);
      return [key, match ? Number(match[2]) : null];
    }),
  );
}

/** The text with every tweak applied. Keys that are missing are left alone rather than invented. */
export function applyTweaks(text: string, tweaks = LIGHTING_TWEAKS): string {
  return tweaks.reduce((out, { key, value }) => out.replace(lineFor(key), `$1${value}`), text);
}

export function isApplied(text: string, tweaks = LIGHTING_TWEAKS): boolean {
  const current = readTweaks(text, tweaks);
  return tweaks.every(({ key, value }) => current[key] === value);
}

// ---- the settings file ----------------------------------------------------------------------

export function settingsFile(): string | null {
  const appData = process.env['APPDATA'];
  return appData ? join(appData, 'Arrowhead', 'Helldivers2', 'user_settings.config') : null;
}

const backupFile = (file: string) => `${file}.bak`;

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export interface GraphicsStatus {
  /** False when the game has not written its settings yet. */
  found: boolean;
  values: Record<string, number | null>;
  applied: boolean;
  hasBackup: boolean;
}

export async function graphicsStatus(): Promise<GraphicsStatus> {
  const file = settingsFile();
  if (!file || !(await exists(file))) return { found: false, values: {}, applied: false, hasBackup: false };
  const text = await readFile(file, 'utf8');
  return { found: true, values: readTweaks(text), applied: isApplied(text), hasBackup: await exists(backupFile(file)) };
}

export type GraphicsResult = 'done' | 'game-running' | 'not-found' | 'no-backup';

/**
 * The game rewrites this file when it exits, so it is only edited while the game is closed. The
 * previous file is kept as a backup first.
 */
export async function applyLightingFix(gameRunning: boolean): Promise<GraphicsResult> {
  if (gameRunning) return 'game-running';
  const file = settingsFile();
  if (!file || !(await exists(file))) return 'not-found';
  await copyFile(file, backupFile(file));
  const text = await readFile(file, 'utf8');
  await writeFile(file, applyTweaks(text), 'utf8');
  return 'done';
}

export async function restoreBackup(gameRunning: boolean): Promise<GraphicsResult> {
  if (gameRunning) return 'game-running';
  const file = settingsFile();
  if (!file) return 'not-found';
  if (!(await exists(backupFile(file)))) return 'no-backup';
  await copyFile(backupFile(file), file);
  return 'done';
}
