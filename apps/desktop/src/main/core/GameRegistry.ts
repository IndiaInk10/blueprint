import type { AnyGameMainModule, GameManifest } from '@guide/sdk';

export class GameRegistry {
  private readonly modules = new Map<string, AnyGameMainModule>();

  register(module: AnyGameMainModule): void {
    const { id } = module.manifest;
    if (this.modules.has(id)) {
      throw new Error(`Game module "${id}" is already registered`);
    }
    this.modules.set(id, module);
  }

  get(id: string): AnyGameMainModule | undefined {
    return this.modules.get(id);
  }

  list(): AnyGameMainModule[] {
    return [...this.modules.values()];
  }

  manifests(): GameManifest[] {
    return [...this.modules.values()].map((module) => module.manifest);
  }
}
