import { describe, expect, it } from 'vitest';
import { HotkeyService } from './HotkeyService';

function createService() {
  const down = new Set<number>();
  const changes: string[][] = [];
  const service = new HotkeyService(
    (keys) => keys.every((key) => down.has(key)),
    (held) => changes.push([...held].sort()),
    60_000, // ticks are driven manually
  );
  service.setBindings([
    { panelId: 'build-tree', keys: [0x09] },
    { panelId: 'combo', keys: [0x11, 0x42] },
  ]);
  return { service, down, changes };
}

describe('HotkeyService', () => {
  it('reports held bindings only when they change', () => {
    const { service, down, changes } = createService();
    service.setActive(true);

    down.add(0x09);
    service.tick();
    service.tick();
    down.add(0x11);
    service.tick();
    down.add(0x42);
    service.tick();
    down.clear();
    service.tick();

    expect(changes).toEqual([['build-tree'], ['build-tree', 'combo'], []]);
    service.setActive(false);
  });

  it('clears held bindings when deactivated', () => {
    const { service, down, changes } = createService();
    down.add(0x09);
    service.setActive(true);
    service.setActive(false);
    expect(changes).toEqual([['build-tree'], []]);
  });
});
