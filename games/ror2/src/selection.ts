import { z } from 'zod';

/** What the user picked to follow in game. Chosen in the main window, shown by the overlay. */
export const selectionSchema = z
  .object({
    survivor: z.string().regex(/^[A-Za-z0-9_-]+$/),
    buildId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  })
  .nullable();

export type Selection = z.infer<typeof selectionSchema>;

export const Ror2Action = {
  GetSelection: 'get-selection',
  Select: 'select',
} as const;
