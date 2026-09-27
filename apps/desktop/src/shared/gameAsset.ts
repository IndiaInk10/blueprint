// Game images (item icons, portraits...) resolved by the game module and cached by the core.

export const GAME_ASSET_SCHEME = 'game-asset';

/** game-asset://<gameId>/<kind>/<id> */
export function gameAssetUrl(gameId: string, kind: string, id: string): string {
  return `${GAME_ASSET_SCHEME}://${gameId}/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

export function parseGameAssetUrl(url: string): { gameId: string; kind: string; id: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const [kind, id, ...rest] = parsed.pathname.slice(1).split('/');
  if (parsed.protocol !== `${GAME_ASSET_SCHEME}:` || !parsed.hostname || !kind || !id || rest.length > 0) return null;
  return { gameId: parsed.hostname, kind: decodeURIComponent(kind), id: decodeURIComponent(id) };
}
