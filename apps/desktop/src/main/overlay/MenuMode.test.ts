import { describe, expect, it } from 'vitest';
import { MenuMode } from './MenuMode';

const keys = (...ids: string[]) => new Set(ids);

describe('MenuMode', () => {
  it('toggles on each ESC press, not while ESC is held', () => {
    const menu = new MenuMode();
    expect(menu.update(keys('menu:esc'))).toBe(true);
    expect(menu.isOpen).toBe(true);
    expect(menu.update(keys('menu:esc'))).toBe(false);
    expect(menu.update(keys())).toBe(false);
    expect(menu.update(keys('menu:esc'))).toBe(true);
    expect(menu.isOpen).toBe(false);
  });

  it('closes when the player moves', () => {
    const menu = new MenuMode();
    menu.update(keys('menu:esc'));
    menu.update(keys());
    expect(menu.update(keys('menu:move:87'))).toBe(true);
    expect(menu.isOpen).toBe(false);
  });

  it('starts closed after a reset', () => {
    const menu = new MenuMode();
    menu.update(keys('menu:esc'));
    menu.reset();
    expect(menu.isOpen).toBe(false);
    expect(menu.update(keys('menu:esc'))).toBe(true);
  });
});
