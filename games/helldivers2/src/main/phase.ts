import type { ScreenRegionSpec } from '@guide/sdk';
import type { Hd2State } from '../state';

/**
 * The top-left corner of the screen tells the ship from a mission: on the ship it names the
 * Super Destroyer ("SES ..." in every language), in a mission it holds the stratagem list.
 */
export const CORNER: ScreenRegionSpec = { id: 'corner', x: 0, y: 0, width: 0.18, height: 0.1 };

/** Frame counters (Steam, GPU tools) sit in the same corner and say nothing about the game. */
const FPS_COUNTER = /\S*\d+\s*FPS/gi;
// OCR sometimes reads the S as 5 or $; the ship name always starts with SES.
const SHIP_NAME = /\b[S5$]E[S5$]\b/i;
/**
 * The mission HUD's stratagem list label, as OCR reads it: "스트라타젬" (also misread as
 * "스트리다생"), "STRATAGEMS", "Stratagèmes", "Estratagemas", "Strategeme".
 */
const STRATAGEM_LABEL = /스트|strat/i;

/**
 * Where the player is, from the corner's text. Both answers need positive evidence: anything
 * else (loading screens, the ESC menu that hides the HUD, only a frame counter) returns null,
 * which keeps the current phase.
 */
export function phaseFromCorner(lines: readonly string[]): Hd2State['phase'] | null {
  const text = lines.join(' ').replace(FPS_COUNTER, ' ').trim();
  if (SHIP_NAME.test(text)) return 'lobby';
  if (STRATAGEM_LABEL.test(text)) return 'mission';
  return null;
}

/** Consecutive agreeing reads needed before the phase changes (reads are ~2 s apart). */
export const CONFIRM_READS = 2;

/**
 * Turns noisy per-read guesses into a stable phase: OCR sometimes misreads a single frame, and
 * the corner changes briefly (menus, map), so one odd read must not flip the overlay.
 */
export class PhaseTracker {
  private current: Hd2State['phase'] = 'unknown';
  private candidate: Hd2State['phase'] | null = null;
  private streak = 0;

  constructor(private readonly confirmReads = CONFIRM_READS) {}

  /** Feed one read; returns the new phase when it changes, else null. */
  observe(read: Hd2State['phase'] | null): Hd2State['phase'] | null {
    if (read === null || read === this.current) {
      this.candidate = null;
      this.streak = 0;
      return null;
    }
    this.streak = read === this.candidate ? this.streak + 1 : 1;
    this.candidate = read;
    if (this.streak < this.confirmReads) return null;
    this.current = read;
    this.candidate = null;
    this.streak = 0;
    return read;
  }
}
