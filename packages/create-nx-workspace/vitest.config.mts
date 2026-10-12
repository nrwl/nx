import { defineConfig } from 'vitest/config';
import { nxSourceResolver } from '../../tools/vitest/nx-source-resolver.mts';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/create-nx-workspace/unit',
  plugins: [nxSourceResolver()],
  resolve: {
    alias: [
      // Source uses CJS-style namespace access (yargs.terminalWidth()); the
      // ESM entry only exposes `default`, so pin to the CJS entry.
      {
        find: /^yargs$/,
        replacement: `${import.meta.dirname}/node_modules/yargs/index.cjs`,
      },
    ],
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['../../tools/vitest/setup.mts'],
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
