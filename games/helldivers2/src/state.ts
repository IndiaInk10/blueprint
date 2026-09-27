export interface Hd2State {
  /** Where the player is. Unknown until a detector can tell the ship from a mission. */
  phase: 'unknown' | 'lobby' | 'mission';
  /** The loadout the player chose to follow, from the main window. */
  loadoutId?: string;
}
