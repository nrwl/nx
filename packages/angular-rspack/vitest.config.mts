import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/angular-rspack/unit',
  root: __dirname,
  plugins: [nxViteTsPaths() as any],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/build/unit',
    },
    reporters: ['default'],
    passWithNoTests: true,
  },
});
