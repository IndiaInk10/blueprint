import type { ScreenRegionSpec } from '@guide/sdk';
import type { Hd2State } from '../state';

/**
 * The top-left corner of the screen tells the ship from a mission: on the ship it names the
 * Super Destroyer ("SES ..." in every language), in a mission it holds the stratagem list.
 */
export const CORNER: ScreenRegionSpec = { id: 'corner', x: 0, y: 0, width: 0.18, height: 0.1 };

/** Where the player is, from the corner's text. Null when the corner is empty (loading, menus). */
export function phaseFromCorner(lines: readonly string[]): Hd2State['phase'] | null {
  const text = lines.join(' ').trim();
  if (!text) return null;
  // OCR sometimes reads the S as 5 or $; the ship name always starts with SES.
  return /\b[S5$]E[S5$]\b/i.test(text) ? 'lobby' : 'mission';
}
