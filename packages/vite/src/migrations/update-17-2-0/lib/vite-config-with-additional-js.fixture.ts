export const viteConfigFixture = `/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { PluginOption, defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

dns.setDefaultResultOrder('verbatim');
const BASE_HREF = '/app';

/**
 * Adds <base href="/app">\` to the head of the index.html
 * The reason why the \`base\` configuration property doesn't work is because it makes
 * all assets served under \`/app\` of \`/\` and this impacts the download zip service worker
 * We only want to the service worker to listen to events related to downloads, but not capture any other events
 * and the only way to do this is make sure all assets are served from the root, but we still want our app path to be \`/app\`
 *
 * This mimics the same behavior we had with webpack before migrating to vite
 */
const baseHrefPlugin: () => PluginOption = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return html.replace('<head>', \`<head>\\n    <base href="\${BASE_HREF}">\`);
    },
  };
};

export default defineConfig({
  cacheDir: '../../node_modules/.vite/jetstream',
  envPrefix: 'NX',

  server: {
    port: 4200,
    host: 'localhost',
  },

  build: {
    // Put all assets at the root of the app instead of under /assets
    assetsDir: './',
    sourcemap: true,
    rollupOptions: {
      output: {
        sourcemap: true,
      },
    },
  },

  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    nxViteTsPaths(),
    baseHrefPlugin(),
  ],

  worker: {
    plugins: [
      nxViteTsPaths(),
    ],
  },
});`;
