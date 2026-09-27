import { z } from 'zod';

const idPattern = /^[A-Za-z0-9_-]+$/;

/** The loadout the overlay shows. Chosen in the main window. */
export const selectionSchema = z.object({ loadoutId: z.string().regex(idPattern) }).nullable();

export type Selection = z.infer<typeof selectionSchema>;

/**
 * What the player owns and how they play. Warbonds are bought in game and kept on the publisher's
 * servers, so the app cannot read them; the player ticks them once.
 */
export const profileSchema = z.object({
  /** Null until the player has told us; recommendations then assume nothing is owned. */
  ownedWarbonds: z.array(z.string().regex(idPattern)).nullable().default(null),
  playstyle: z.string().regex(idPattern).nullable().default(null),
  faction: z.string().regex(idPattern).nullable().default(null),
});

export type Profile = z.infer<typeof profileSchema>;

export const Hd2Action = {
  GetSelection: 'get-selection',
  Select: 'select',
  GetProfile: 'get-profile',
  SetProfile: 'set-profile',
} as const;
