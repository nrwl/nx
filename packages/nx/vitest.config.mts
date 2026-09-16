import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/nx/unit',
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
    // Imports use native-bindings.js directly through nativeShim, while lazy
    // requires use native/index.js. Keep both on the same binary: loading a
    // cached copy too lets Rust external references cross allocator instances
    // and can segfault when a TaskHasher is garbage-collected.
    env: { NX_SKIP_NATIVE_FILE_CACHE: 'true' },
    watch: false,
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['src/native/tui/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.mts'],
    // Isolated plugin workers boot via swc (see isolated-plugin.ts). Under the
    // previous ts-node boot they cost ~2.8s each, which pushed the graph
    // recompute spec past this limit on CI - keep the two changes together.
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
        // The napi loader runs under node, not vite, for every import and
        // every lazy `require('../native')` alike, so a worker holds a single
        // copy of the binding. Two copies are two jemalloc heaps, and a value
        // freed by the heap that did not allocate it kills the worker.
        external: [
          /src\/native\/index\.js/,
          /src\/native\/native-bindings\.js/,
          /\.node$/,
        ],
      },
    },
  },
});
