/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig(({ mode }) => {
  return {
    cacheDir: '../../node_modules/.vite/graph-client',
    server: {
      port: 4200,
      host: 'localhost',
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },
    publicDir: mode !== 'production',
    plugins: [
      preact(),
      svgr(),
      viteTsConfigPaths({
        root: '../../',
        projects: [
          'graph/client',
          'graph/ui-components',
          'graph/ui-tooltips',
          'graph/ui-graph',
        ],
      }),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            environmentFile:
              mode === 'production'
                ? 'environment.js'
                : `environment.${mode}.js`,
          },
        },
      }),
    ],

    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [
    //    viteTsConfigPaths({
    //      root: '../../',
    //    }),
    //  ],
    // },
  };
});
