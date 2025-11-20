const {
  patchDevkitRequestPath,
  patchModuleFederationRequestPath,
} = require('../../patch-devkit-request-path');
module.exports = () => {
  if (global.NX_GRAPH_CREATION === undefined) {
    // This is needed to ensure that the `@nx/angular-rspack` package can find the build artefact for `@nx/devkit`
    // TODO(colum): Remove this once packages in Nx are built to local dist
    const {
      patchDevkitRequestPath,
      patchModuleFederationRequestPath,
    } = require('../../patch-devkit-request-path');
    const cleanupDevkitPatch = patchDevkitRequestPath();
    const cleanupModuleFederationPatch = patchModuleFederationRequestPath();
    const {
      NxModuleFederationPlugin,
      NxModuleFederationDevServerPlugin,
    } = require('@nx/module-federation/angular');
    const { createConfig } = require('@nx/angular-rspack');
    const mfConfig = require('./module-federation.config');
    const config = createConfig(
      {
        options: {
          root: __dirname,
          outputPath: {
            base: './dist',
            browser: './browser',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          tsConfig: './tsconfig.app.json',
          polyfills: ['zone.js'],
          assets: [{ glob: '**/*', input: 'public' }],
          statsJson: true,
          styles: ['./src/styles.scss'],
        },
        rspackConfigOverrides: {
          plugins: [
            new NxModuleFederationPlugin(
              { config: mfConfig },
              {
                dts: false,
              }
            ),
            new NxModuleFederationDevServerPlugin({ config: mfConfig }),
          ],
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
            devServer: {
              /**
               * These values MUST be set to ensure that the webSocketSettings within the devServer config is configured to
               * only listen for updates to this specific project. Otherwise, a live reload loop could be created.
               */
              publicHost: 'localhost:4200',
              port: 4200,
            },
          },
        },
        production: {
          options: {
            extractLicenses: false,
            outputHashing: 'all',
            optimization: {
              scripts: true,
              styles: {
                minify: false,
                inlineCritical: true,
              },
            },
          },
        },
      }
    );
    cleanupDevkitPatch();
    cleanupModuleFederationPatch();
    return config;
  }
  return {};
};
