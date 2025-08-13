module.exports = () => {
  if (global.NX_GRAPH_CREATION === undefined) {
    // This is needed to ensure that the `@nx/angular-rspack` package can find the build artefact for `@nx/devkit`
    // TODO(colum): Remove this once packages in Nx are built to local dist
    const { patchDevkitRequestPath } = require('../patch-devkit-request-path');
    const cleanupPatch = patchDevkitRequestPath();
    const { createConfig } = require('@nx/angular-rspack');
    const config = createConfig(
      {
        options: {
          root: __dirname,
          index: './src/index.html',
          assets: [
            {
              input: '../shared/assets/src/assets',
              glob: '**/*',
              output: 'assets',
            },
            { glob: '**/*', input: 'public' },
          ],
          styles: [
            {
              input: '../shared/styles/src/index.scss',
              bundleName: 'shared-styles',
            },
            './src/styles.css',
          ],
          scripts: [
            './scripts/script1.js',
            { input: './scripts/script2.js', bundleName: 'scripts' },
            {
              input: './scripts/internal-shared-script.js',
              bundleName: 'shared-scripts',
            },
            {
              input: '../shared/scripts/shared-script.js',
              bundleName: 'shared-scripts',
            },
            {
              input: './scripts/non-initial-script.js',
              bundleName: 'non-initial-script',
              inject: false,
            },
          ],
          polyfills: [],
          browser: './src/main.ts',
          outputPath: {
            base: './dist',
            browser: './static',
          },
          sourceMap: {
            scripts: true,
            styles: true,
          },
          tsConfig: './tsconfig.app.json',
          skipTypeChecking: false,
          devServer: {
            host: '127.0.0.1',
            port: 8080,
            proxyConfig: './proxy.conf.json',
            hmr: true,
            liveReload: false,
            open: false, // Set to true when testing open option
          },
          define: {
            nxAngularRspack: '"20.6.2"',
          },
          baseHref: '/foo',
          subresourceIntegrity: true,
          crossOrigin: 'anonymous',
          watch: false, // Set to true when testing watch mode
        },
      },
      {
        development: {
          options: {
            extractLicenses: false,
            optimization: false,
            outputHashing: 'none',
            namedChunks: true,
            vendorChunk: true,
          },
        },
        production: {
          options: {
            budgets: [
              {
                type: 'initial',
                maximumWarning: '500kB',
                maximumError: '1MB',
              },
              {
                type: 'anyComponentStyle',
                maximumWarning: '4kB',
                maximumError: '8kB',
              },
            ],
            outputHashing: 'all',
          },
        },
      }
    );
    cleanupPatch();
    return config;
  }
  return {};
};
