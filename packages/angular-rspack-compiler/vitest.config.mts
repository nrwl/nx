import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/angular-rspack-compiler/unit',
  plugins: [],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['./test-utils/fs-memfs.setup-file.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage/angular-rspack-compiler/unit',
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
  },
});
