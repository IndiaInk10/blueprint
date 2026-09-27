export interface HotkeyBinding {
  panelId: string;
  /** Windows virtual-key codes, all held together. */
  keys: number[];
}

/**
 * Polls key state for registered combos and reports which bindings are held.
 * Polling (instead of a global keyboard hook) never swallows input, so the game still sees every key.
 */
export class HotkeyService {
  private bindings: HotkeyBinding[] = [];
  private held = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly areKeysDown: (keys: number[]) => boolean,
    private readonly onChange: (held: ReadonlySet<string>) => void,
    private readonly intervalMs = 50,
  ) {}

  setBindings(bindings: HotkeyBinding[]): void {
    this.bindings = bindings;
    if (this.timer) this.tick();
  }

  /** Poll only while it matters, e.g. while the game has focus. */
  setActive(active: boolean): void {
    if (active && !this.timer) {
      this.tick();
      this.timer = setInterval(() => this.tick(), this.intervalMs);
    } else if (!active && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.update(new Set());
    }
  }

  tick(): void {
    const next = new Set<string>();
    for (const binding of this.bindings) {
      if (this.areKeysDown(binding.keys)) next.add(binding.panelId);
    }
    this.update(next);
  }

  private update(next: Set<string>): void {
    const changed = next.size !== this.held.size || [...next].some((id) => !this.held.has(id));
    if (!changed) return;
    this.held = next;
    this.onChange(next);
  }
}
