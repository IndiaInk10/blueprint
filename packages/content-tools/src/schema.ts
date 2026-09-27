// Document-format pieces every game's content shares. Game-specific schemas build on these.
import { z } from 'zod';

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]+$/, 'ids use letters, digits, "_" and "-" only');

/** Our own authored text. English is required as the fallback. */
export const localizedText = z.object({ en: z.string().min(1), ko: z.string().min(1).optional() });
export type LocalizedText = z.infer<typeof localizedText>;

/**
 * Image file name in a game's image source (e.g. a wiki), such as "Soldier's_Syringe.png".
 * Images are fetched and cached at runtime, never bundled with the app.
 */
export const imageFile = z.string().regex(/^[^/\\?#]+\.(png|jpg|jpeg|webp|svg)$/i, 'a bare image file name');

/**
 * Every document starts with this header. The same fields become row metadata if content moves
 * to a database, and let a remote source tell what changed and whether an app can read it.
 * revision/updatedAt are maintained by the stamp step.
 */
export const documentHeader = <K extends string>(kind: K) =>
  z.object({
    kind: z.literal(kind),
    schemaVersion: z.number().int().positive(),
    revision: z.number().int().positive(),
    updatedAt: z.iso.date(),
  });

/** One per content bundle: the release as a whole. */
export const manifestSchema = z.object({
  kind: z.literal('manifest'),
  schemaVersion: z.number().int().positive(),
  /** Content release, YYYY.MM.DD.N. Compared by remote sources to decide whether to update. */
  version: z.string().regex(/^\d{4}\.\d{2}\.\d{2}\.\d+$/),
  gameVersion: z.string().min(1),
  updatedAt: z.iso.date(),
});
export type ContentManifest = z.infer<typeof manifestSchema>;

export function describeZodError(name: string, error: z.ZodError): string {
  return `${name}: ${z.prettifyError(error)}`;
}

/**
 * Rejects documents written for a newer app. Returns a problem message, or null when readable.
 * Checked before full parsing so a newer format never gets half-understood.
 */
export function schemaVersionProblem(name: string, document: unknown, supported: number): string | null {
  const version = (document as { schemaVersion?: unknown } | null)?.schemaVersion;
  return typeof version === 'number' && version > supported
    ? `${name}: schemaVersion ${version} needs a newer app (this app reads up to ${supported})`
    : null;
}
