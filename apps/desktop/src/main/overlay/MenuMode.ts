import type { HotkeyBinding } from '../core/HotkeyService';

const VK_ESCAPE = 0x1b;
/** W, A, S, D: moving means the player is back in the game, not in a menu. */
const MOVE_KEYS = [0x57, 0x41, 0x53, 0x44];

/** Key bindings the menu tracker needs polled. */
export const MENU_BINDINGS: HotkeyBinding[] = [
  { panelId: 'menu:esc', keys: [VK_ESCAPE] },
  ...MOVE_KEYS.map((key) => ({ panelId: `menu:move:${key}`, keys: [key] })),
];

/**
 * Whether the game's ESC menu is probably open, from key presses alone: each ESC press toggles
 * it, and moving closes it (menus can also be left with the mouse, so ESC alone would drift).
 * While it is open the overlay lets the mouse use its panels.
 */
export class MenuMode {
  private open = false;
  private escHeld = false;

  get isOpen(): boolean {
    return this.open;
  }

  /** Feed the currently held bindings; returns true when the open state changed. */
  update(held: ReadonlySet<string>): boolean {
    const was = this.open;
    const escHeld = held.has('menu:esc');
    if (escHeld && !this.escHeld) this.open = !this.open;
    this.escHeld = escHeld;
    if ([...held].some((id) => id.startsWith('menu:move:'))) this.open = false;
    return this.open !== was;
  }

  reset(): void {
    this.open = false;
    this.escHeld = false;
  }
}
