import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  root: './',
  source: {
    tsconfigPath: './mocks/fixtures/integration/minimal/tsconfig.mock.json',
  },
  environments: {
    browser: {
      source: {
        entry: {
          index: './src/main.ts',
        },
      },
      output: {
        target: 'web',
        distPath: {
          root: 'dist/browser',
        },
      },
      html: {
        template: 'index.html',
      },
    },
  },
});
