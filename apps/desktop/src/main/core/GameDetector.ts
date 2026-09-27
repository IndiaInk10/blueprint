import type { GameManifest, Logger } from '@guide/sdk';

export interface ProcessInfo {
  pid: number;
  name: string;
}

export interface ProcessSource {
  list(): ProcessInfo[];
}

export type DetectorEvent = { type: 'started' | 'stopped'; gameId: string; pid: number };

/**
 * Polls the process list and reports when a registered game starts or stops.
 * Window-level tracking (focus, bounds) is event driven and lives in the overlay layer.
 */
export class GameDetector {
  private readonly exeToGame = new Map<string, string>();
  private readonly running = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    manifests: GameManifest[],
    private readonly source: ProcessSource,
    private readonly onEvent: (event: DetectorEvent) => void,
    private readonly log: Logger,
    private readonly intervalMs = 2000,
  ) {
    for (const manifest of manifests) {
      for (const exe of manifest.process.exe) this.exeToGame.set(exe.toLowerCase(), manifest.id);
    }
  }

  start(): void {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  runningPid(gameId: string): number | undefined {
    return this.running.get(gameId);
  }

  tick(): void {
    let processes: ProcessInfo[];
    try {
      processes = this.source.list();
    } catch (error) {
      this.log.error('Process listing failed', String(error));
      return;
    }

    const seen = new Map<string, number>();
    for (const { pid, name } of processes) {
      const gameId = this.exeToGame.get(name.toLowerCase());
      if (gameId && !seen.has(gameId)) seen.set(gameId, pid);
    }

    for (const [gameId, pid] of this.running) {
      if (seen.get(gameId) !== pid) {
        this.running.delete(gameId);
        this.onEvent({ type: 'stopped', gameId, pid });
      }
    }
    for (const [gameId, pid] of seen) {
      if (!this.running.has(gameId)) {
        this.running.set(gameId, pid);
        this.onEvent({ type: 'started', gameId, pid });
      }
    }
  }
}
