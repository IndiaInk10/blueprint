import type { GameManifest, Logger } from '@guide/sdk';
import { describe, expect, it } from 'vitest';
import { GameDetector, type DetectorEvent, type ProcessInfo } from './GameDetector';

const manifest: GameManifest = {
  id: 'ror2',
  displayName: { en: 'Risk of Rain 2' },
  process: { exe: ['Risk of Rain 2.exe'] },
  window: [],
  antiCheat: 'none',
  overlay: { backends: ['window'] },
};

const silentLog: Logger = { info() {}, warn() {}, error() {} };

function createDetector() {
  let processes: ProcessInfo[] | Error = [];
  const events: DetectorEvent[] = [];
  const list = () => {
    if (processes instanceof Error) throw processes;
    return processes;
  };
  const detector = new GameDetector([manifest], { list }, (e) => events.push(e), silentLog);
  return {
    detector,
    events,
    setProcesses: (next: ProcessInfo[] | Error) => {
      processes = next;
    },
  };
}

describe('GameDetector', () => {
  it('emits started and stopped as the game process appears and disappears', () => {
    const { detector, events, setProcesses } = createDetector();

    setProcesses([{ pid: 1, name: 'explorer.exe' }]);
    detector.tick();
    expect(events).toEqual([]);

    setProcesses([{ pid: 42, name: 'risk of rain 2.EXE' }]);
    detector.tick();
    detector.tick();
    expect(events).toEqual([{ type: 'started', gameId: 'ror2', pid: 42 }]);
    expect(detector.runningPid('ror2')).toBe(42);

    setProcesses([]);
    detector.tick();
    expect(events.at(-1)).toEqual({ type: 'stopped', gameId: 'ror2', pid: 42 });
    expect(detector.runningPid('ror2')).toBeUndefined();
  });

  it('treats a restart with a new pid as stop then start', () => {
    const { detector, events, setProcesses } = createDetector();
    setProcesses([{ pid: 42, name: 'Risk of Rain 2.exe' }]);
    detector.tick();
    setProcesses([{ pid: 77, name: 'Risk of Rain 2.exe' }]);
    detector.tick();
    expect(events).toEqual([
      { type: 'started', gameId: 'ror2', pid: 42 },
      { type: 'stopped', gameId: 'ror2', pid: 42 },
      { type: 'started', gameId: 'ror2', pid: 77 },
    ]);
  });

  it('keeps state when the process source throws', () => {
    const { detector, events, setProcesses } = createDetector();
    setProcesses([{ pid: 42, name: 'Risk of Rain 2.exe' }]);
    detector.tick();
    setProcesses(new Error('snapshot failed'));
    detector.tick();
    expect(events).toHaveLength(1);
    expect(detector.runningPid('ror2')).toBe(42);
  });
});
