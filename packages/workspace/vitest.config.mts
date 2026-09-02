import { defineConfig } from 'vitest/config';
import { nxSourceResolver } from '../../scripts/vitest-nx-source-resolver.mts';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/workspace/unit',
  plugins: [nxSourceResolver()],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/files/**'],
    setupFiles: ['../../scripts/vitest-setup.mts'],
    // Matches jest.preset.js.
    testTimeout: 35000,
    // nx's native .node bindings are not thread-safe across worker threads.
    pool: 'forks',
    // Specs that stand up native workspace contexts leave their worker slow to
    // exit; the jest setup hid the same slowness behind `--forceExit`.
    teardownTimeout: 60_000,
    // Node-side (lazy require) resolution needs the same source condition the
    // resolver plugin provides for imports.
    execArgv: ['--conditions=@nx/nx-source'],
    server: {
      deps: {
        external: [/src\/native\/native-bindings\.js/, /\.node$/],
      },
    },
  },
});
