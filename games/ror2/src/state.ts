export interface Ror2State {
  phase: 'unknown' | 'menu' | 'character-select' | 'in-run';
  /** Internal body id, e.g. "MageBody". */
  survivor?: string;
  buildId?: string;
  stage?: number;
  /** itemId -> stack count. Only filled when the companion mod is present. */
  inventory?: Record<string, number>;
}
