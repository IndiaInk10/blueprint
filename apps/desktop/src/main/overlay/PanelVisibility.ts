import type { PanelRegistration } from '../../shared/ipc';
import type { HotkeyBinding } from '../core/HotkeyService';

const VISIBILITIES = new Set(['pinned', 'hold-hotkey', 'toggle']);
const MAX_KEYS = 8;

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

function isKeys(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_KEYS &&
    value.every((key) => Number.isInteger(key) && key > 0 && key < 256)
  );
}

export function isPanelRegistration(value: unknown): value is PanelRegistration {
  if (typeof value !== 'object' || value === null) return false;
  const { panelId, visibility, keys } = value as Record<string, unknown>;
  if (!isId(panelId) || typeof visibility !== 'string' || !VISIBILITIES.has(visibility)) return false;
  if (keys !== undefined && !isKeys(keys)) return false;
  // Hotkey-driven panels are useless without keys.
  return visibility === 'pinned' || keys !== undefined;
}

/** Which panels should be on screen, given hotkey state and the user's per-panel switches. */
export class PanelVisibility {
  private panels: PanelRegistration[] = [];
  private held: ReadonlySet<string> = new Set();
  private readonly toggled = new Set<string>();

  setPanels(panels: PanelRegistration[]): void {
    this.panels = panels;
    const ids = new Set(panels.map((panel) => panel.panelId));
    for (const id of this.toggled) if (!ids.has(id)) this.toggled.delete(id);
  }

  hotkeyBindings(): HotkeyBinding[] {
    return this.panels.flatMap((panel) =>
      panel.visibility !== 'pinned' && panel.keys ? [{ panelId: panel.panelId, keys: panel.keys }] : [],
    );
  }

  setHeld(held: ReadonlySet<string>): void {
    for (const id of held) {
      if (this.held.has(id)) continue;
      const panel = this.panels.find((p) => p.panelId === id);
      if (panel?.visibility !== 'toggle') continue;
      if (this.toggled.has(id)) this.toggled.delete(id);
      else this.toggled.add(id);
    }
    this.held = held;
  }

  visible(isEnabled: (panelId: string) => boolean): string[] {
    return this.panels
      .filter((panel) => {
        if (!isEnabled(panel.panelId)) return false;
        switch (panel.visibility) {
          case 'pinned':
            return true;
          case 'hold-hotkey':
            return this.held.has(panel.panelId);
          case 'toggle':
            return this.toggled.has(panel.panelId);
        }
      })
      .map((panel) => panel.panelId);
  }
}
