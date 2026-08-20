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
    poolOptions: {
      forks: {
        // Node-side (lazy require) resolution needs the same source
        // condition vite's resolve.conditions provides for imports.
        execArgv: ['--conditions=@nx/nx-source'],
      },
    },
    server: {
      deps: {
        external: [/src\/native\/native-bindings\.js/, /\.node$/],
      },
    },
  },
});
