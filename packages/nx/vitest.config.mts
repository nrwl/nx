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
    // Prefer local TS source for nx's
    // own exports map.
    conditions: ['@nx/nx-source'],
    // `nx` resolves to the published package, which ships dist and no src, so
    // its `@nx/nx-source` exports point at files that aren't there.
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
    include: ['**/*.spec.ts'],
    exclude: ['src/native/tui/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.mts'],
    testTimeout: 35000,
    // Native .node bindings are not thread-safe across vitest worker threads.
    pool: 'forks',
    // Specs that stand up native workspace contexts leave their worker slow to
    // exit - not stuck, just past the 10s default once the pool is loaded. The
    // pool then kills it and that file's results are lost. The jest setup hid
    // the same slowness behind `--forceExit`.
    teardownTimeout: 60_000,
    // Node-side (lazy require) resolution needs the same source
    // condition vite's resolve.conditions provides for imports.
    execArgv: [
      '--conditions=@nx/nx-source',
      '--require',
      `${import.meta.dirname}/vitest-write-guard.cjs`,
    ],
    server: {
      deps: {
        external: [/src\/native\/native-bindings\.js/, /\.node$/],
      },
    },
  },
});
