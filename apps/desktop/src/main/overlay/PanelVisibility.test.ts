import { describe, expect, it } from 'vitest';
import { isPanelRegistration, PanelVisibility } from './PanelVisibility';

const allEnabled = () => true;

describe('PanelVisibility', () => {
  function create() {
    const panels = new PanelVisibility();
    panels.setPanels([
      { panelId: 'pinned', visibility: 'pinned' },
      { panelId: 'hold', visibility: 'hold-hotkey', keys: [0x09] },
      { panelId: 'toggle', visibility: 'toggle', keys: [0x75] },
    ]);
    return panels;
  }

  it('always shows pinned panels and only binds hotkeys for the others', () => {
    const panels = create();
    expect(panels.visible(allEnabled)).toEqual(['pinned']);
    expect(panels.hotkeyBindings().map((b) => b.panelId)).toEqual(['hold', 'toggle']);
  });

  it('shows hold panels while held and flips toggle panels on each press', () => {
    const panels = create();
    panels.setHeld(new Set(['hold', 'toggle']));
    expect(panels.visible(allEnabled)).toEqual(['pinned', 'hold', 'toggle']);

    panels.setHeld(new Set(['toggle'])); // still held: no second flip
    expect(panels.visible(allEnabled)).toEqual(['pinned', 'toggle']);

    panels.setHeld(new Set());
    expect(panels.visible(allEnabled)).toEqual(['pinned', 'toggle']);

    panels.setHeld(new Set(['toggle']));
    expect(panels.visible(allEnabled)).toEqual(['pinned']);
  });

  it('respects the per-panel switch', () => {
    const panels = create();
    expect(panels.visible((id) => id !== 'pinned')).toEqual([]);
  });

  it('validates registrations from the renderer', () => {
    expect(isPanelRegistration({ panelId: 'a', visibility: 'pinned' })).toBe(true);
    expect(isPanelRegistration({ panelId: 'a', visibility: 'toggle', keys: [9] })).toBe(true);
    expect(isPanelRegistration({ panelId: 'a', visibility: 'toggle' })).toBe(false);
    expect(isPanelRegistration({ panelId: 'a', visibility: 'hold-hotkey', keys: [0] })).toBe(false);
    expect(isPanelRegistration({ panelId: '', visibility: 'pinned' })).toBe(false);
    expect(isPanelRegistration({ panelId: 'a', visibility: 'always' })).toBe(false);
  });
});
