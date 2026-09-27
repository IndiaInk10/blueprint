// Main-process game registration. Add new games here and in ../renderer/src/games.ts.
import type { AnyGameMainModule } from '@guide/sdk';
import { hd2Main } from '@guide/game-helldivers2/main';
import { ror2Main } from '@guide/game-ror2/main';

export const games: AnyGameMainModule[] = [ror2Main, hd2Main];
