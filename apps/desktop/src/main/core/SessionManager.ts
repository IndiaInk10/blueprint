import type { Disposable, Logger, MainHost } from '@guide/sdk';
import type { SessionInfo } from '../../shared/ipc';
import type { GameRegistry } from './GameRegistry';
import { StateStore } from './StateStore';

interface Session {
  pid: number;
  startedAt: number;
  store: StateStore<object>;
  disposables: Disposable[];
}

/** One session per running game: owns its state store and the module's state providers. */
export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly registry: GameRegistry,
    private readonly createHost: (gameId: string) => MainHost,
    private readonly onChange: (gameId: string) => void,
    private readonly log: Logger,
  ) {}

  start(gameId: string, pid: number): void {
    const module = this.registry.get(gameId);
    if (!module || this.sessions.has(gameId)) return;

    const host = this.createHost(gameId);
    const session: Session = {
      pid,
      startedAt: Date.now(),
      store: new StateStore(module.initialState(), () => this.onChange(gameId)),
      disposables: [],
    };
    // Registered before providers start so their first emit already sees the session.
    this.sessions.set(gameId, session);

    for (const provider of module.stateProviders(host)) {
      try {
        session.disposables.push(provider.start(host, (patch) => session.store.apply(provider.priority, patch)));
      } catch (error) {
        this.log.error('State provider failed to start', { gameId, provider: provider.id, error: String(error) });
      }
    }

    this.log.info('Session started', { gameId, pid });
    this.onChange(gameId);
  }

  stop(gameId: string): void {
    const session = this.sessions.get(gameId);
    if (!session) return;
    this.sessions.delete(gameId);
    for (const disposable of session.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        this.log.error('State provider failed to stop', { gameId, error: String(error) });
      }
    }
    this.log.info('Session stopped', { gameId, pid: session.pid });
    this.onChange(gameId);
  }

  /** Lets module actions update state outside of a provider. Ignored while the game is not running. */
  applyPatch(gameId: string, priority: number, patch: object): void {
    this.sessions.get(gameId)?.store.apply(priority, patch);
  }

  stopAll(): void {
    for (const gameId of [...this.sessions.keys()]) this.stop(gameId);
  }

  info(gameId: string): SessionInfo | null {
    const session = this.sessions.get(gameId);
    return session ? { pid: session.pid, startedAt: session.startedAt, state: session.store.state } : null;
  }
}
