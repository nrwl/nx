import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { EXCLUDED_FILES_TEST } from '@ng-rspack/testing-setup';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/build/integration',
  plugins: [],
  resolve: {
    alias: {
      '@ng-rspack/testing-utils': resolve(__dirname, '../../testing/utils/src'),
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/build/integration',
      exclude: [...EXCLUDED_FILES_TEST],
    },
  },
});
