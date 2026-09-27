import { describe, expect, it } from 'vitest';
import { gameAssetUrl, parseGameAssetUrl } from './gameAsset';

describe('game asset urls', () => {
  it('round-trips ids with special characters', () => {
    const url = gameAssetUrl('ror2', 'item', "Soldier's Syringe/../x");
    expect(parseGameAssetUrl(url)).toEqual({ gameId: 'ror2', kind: 'item', id: "Soldier's Syringe/../x" });
  });

  it('rejects other schemes and malformed paths', () => {
    expect(parseGameAssetUrl('https://ror2/item/Syringe')).toBeNull();
    expect(parseGameAssetUrl('game-asset://ror2/item')).toBeNull();
    expect(parseGameAssetUrl('game-asset://ror2/item/a/b')).toBeNull();
    expect(parseGameAssetUrl('nonsense')).toBeNull();
  });
});
