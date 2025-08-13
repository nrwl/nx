import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/angular-rspack/unit',
  root: __dirname,
  resolve: {
    alias: {
      '@nx/devkit': resolve('./test-utils/nx-devkit-mock.ts'),
    },
  },
  test: {
    watch: false,
    globals: true,
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
