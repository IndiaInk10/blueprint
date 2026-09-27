import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

// Workspace packages ship TypeScript source, so they must be bundled instead of externalized.
// Native addons are the exception: they load a .node binary at runtime and stay external.
const nativeDeps = new Set(['@guide/overlay-native']);
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>;
};
const workspaceDeps = Object.keys(pkg.dependencies).filter(
  (name) => name.startsWith('@guide/') && !nativeDeps.has(name),
);

export default defineConfig({
  main: {
    build: { externalizeDeps: { exclude: workspaceDeps } },
  },
  preload: {
    build: { externalizeDeps: { exclude: workspaceDeps } },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL('./src/renderer/index.html', import.meta.url)),
          overlay: fileURLToPath(new URL('./src/renderer/overlay.html', import.meta.url)),
        },
      },
    },
  },
});
