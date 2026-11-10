import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { nxSourceResolver } from '../../tools/vitest/nx-source-resolver.mts';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/devkit/unit',
  plugins: [nxSourceResolver()],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
    setupFiles: ['../../tools/vitest/setup.mts'],
    // Matches jest.preset.js.
    testTimeout: 35000,
    // nx's native .node bindings are not thread-safe across worker threads.
    pool: 'forks',
    // Specs that stand up native workspace contexts leave their worker slow to
    // exit; the jest setup hid the same slowness behind `--forceExit`.
    teardownTimeout: 60_000,
    execArgv: [
      // Node-side (lazy require) resolution needs the same source condition
      // the resolver plugin provides for imports.
      '--conditions=@nx/nx-source',
      // Must run before any nx module computes `workspaceDataDirectory`.
      '--require',
      join(import.meta.dirname, 'vitest-setup-nx-workspace-data-dir.cjs'),
    ],
    server: {
      deps: {
        external: [/src\/native\/native-bindings\.js/, /\.node$/],
      },
    },
  },
});
