import { defineConfig, type Plugin } from 'vitest/config';
import { resolve } from 'path';

const nativeIndex = resolve(import.meta.dirname, 'src/native/index.js');
const nativeBindings = resolve(
  import.meta.dirname,
  'src/native/native-bindings.js'
);

/**
 * `src/native/index.js` is the napi loader with the file-cache Module._load
 * patch; it requires TS files ('../utils/versions') so it cannot run outside
 * a transform. Route every import of it to the self-contained generated
 * loader `native-bindings.js` instead, which is externalized below so node
 * requires the .node binding natively.
 */
const nativeShim: Plugin = {
  name: 'nx-native-shim',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (source === nativeBindings || importer === nativeBindings) return null;
    const r = await this.resolve(source, importer, options);
    if (r && (r.id === nativeIndex || r.id.startsWith(nativeIndex + '?'))) {
      return nativeBindings;
    }
    return null;
  },
};

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/nx/unit',
  plugins: [nativeShim],
  resolve: {
    // Match the jest-resolver.js behavior: prefer local TS source for nx's
    // own exports map.
    conditions: ['@nx/nx-source'],
    // Deep imports like nx/src/... and nx/bin/... aren't in the exports map;
    // the jest resolver allowed them, so map them straight to source.
    alias: [
      { find: /^nx\/src\/(.*)$/, replacement: `${import.meta.dirname}/src/$1` },
      { find: /^nx\/bin\/(.*)$/, replacement: `${import.meta.dirname}/bin/$1` },
      // Source uses CJS-style namespace access (yargs.terminalWidth()); the
      // ESM entry only exposes `default`, so pin to the CJS entry, which
      // vitest interops as jest did.
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
    include: [
      'src/**/*.spec.ts',
      'bin/**/*.spec.ts',
      'plugins/**/*.spec.ts',
      'release/**/*.spec.ts',
      'migrations.spec.ts',
    ],
    exclude: ['src/native/tui/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.mts'],
    testTimeout: 35000,
    // Native .node bindings are not thread-safe across vitest worker threads.
    pool: 'forks',
    // A worker occasionally fails to terminate within `teardownTimeout` and is
    // then killed, which surfaces as an unhandled pool error and fails a run in
    // which every test passed. The jest setup papered over the same leak with
    // `--forceExit`. NOTE: this only suppresses the error, so a killed worker's
    // file is silently missing from the results - compare the reported file
    // count against the expected one when reading a green run.
    dangerouslyIgnoreUnhandledErrors: true,
    // Node-side (lazy require) resolution needs the same source
    // condition vite's resolve.conditions provides for imports.
    execArgv: ['--conditions=@nx/nx-source'],
    server: {
      deps: {
        external: [/src\/native\/native-bindings\.js/, /\.node$/],
      },
    },
  },
});
