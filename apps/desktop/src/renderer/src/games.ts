// Renderer game registration. Keep in sync with ../../main/games.ts.
import type { AnyGameRendererModule } from '@guide/sdk';
import { hd2Renderer } from '@guide/game-helldivers2/renderer';
import { ror2Renderer } from '@guide/game-ror2/renderer';

const modules: AnyGameRendererModule[] = [ror2Renderer, hd2Renderer];

export const rendererModules = new Map(modules.map((module) => [module.manifest.id, module]));
