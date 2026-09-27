// Library art is read at runtime from the user's own Steam cache and is never bundled with the app.

export const STEAM_ART_SCHEME = 'steam-art';

export const LIBRARY_ART_KINDS = ['hero', 'logo', 'capsule', 'header', 'icon'] as const;
export type LibraryArtKind = (typeof LIBRARY_ART_KINDS)[number];

export function isLibraryArtKind(value: string): value is LibraryArtKind {
  return (LIBRARY_ART_KINDS as readonly string[]).includes(value);
}

/** Fixed host: a purely numeric host would be parsed as an IPv4 address by the URL parser. */
export const STEAM_ART_HOST = 'library';

export function steamArtUrl(appId: number, kind: LibraryArtKind): string {
  return `${STEAM_ART_SCHEME}://${STEAM_ART_HOST}/${appId}/${kind}`;
}
