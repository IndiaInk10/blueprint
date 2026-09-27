/**
 * Holds one game's state. Providers write partial patches; a field written by a
 * higher-priority provider cannot be overwritten by a lower-priority one.
 */
export class StateStore<S extends object> {
  private current: S;
  private readonly fieldPriority = new Map<keyof S, number>();

  constructor(
    initial: S,
    private readonly onChange: (state: S) => void,
  ) {
    this.current = { ...initial };
  }

  get state(): S {
    return this.current;
  }

  apply(priority: number, patch: Partial<S>): void {
    const next = { ...this.current };
    let changed = false;
    for (const key of Object.keys(patch) as (keyof S)[]) {
      const owner = this.fieldPriority.get(key);
      if (owner !== undefined && owner > priority) continue;
      this.fieldPriority.set(key, priority);
      if (!Object.is(next[key], patch[key])) {
        next[key] = patch[key] as S[keyof S];
        changed = true;
      }
    }
    if (!changed) return;
    this.current = next;
    this.onChange(next);
  }
}
