import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/angular-rspack/unit',
  root: __dirname,
  resolve: {
    // Use regex aliases so each subpath is intercepted independently. Plain
    // string aliases (e.g., `'@nx/devkit'`) do prefix matching in vite, which
    // would rewrite `@nx/devkit/internal` to `<mock-file-path>/internal` and
    // fail to resolve.
    alias: [
      {
        find: /^@nx\/devkit$/,
        replacement: resolve('./test-utils/nx-devkit-mock.ts'),
      },
      {
        find: /^@nx\/devkit\/internal$/,
        replacement: resolve('./test-utils/nx-devkit-internal-mock.ts'),
      },
      // Load the sibling workspace package from source so its imports
      // (e.g. `@nx/devkit/internal`) go through the aliases above instead of
      // resolving via the built dist's CJS `require`.
      {
        find: /^@nx\/angular-rspack-compiler$/,
        replacement: resolve('../angular-rspack-compiler/src/index.ts'),
      },
    ],
  },
  test: {
    watch: false,
    environment: 'node',
    include: ['src/**/*.spec.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage/angular-rspack/unit',
      exclude: [
        'mocks/**',
        '**/types.ts',
        '**/*.d.ts',
        '__snapshots__/**',
        '**/__tests__/**',
        '**/.eslintrc.json',
        '**/vitest*.config.mts',
      ],
    },
    reporters: ['default'],
    passWithNoTests: true,
  },
});
