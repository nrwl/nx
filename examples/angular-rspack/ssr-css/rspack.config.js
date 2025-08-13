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
          browser: './src/main.ts',
          index: './src/index.html',
          server: './src/main.server.ts',
          polyfills: ['zone.js'],
          ssr: { entry: './src/server.ts' },
          verbose: true,
          assets: [
            {
              glob: '**/*',
              input: './public',
            },
          ],
        },
      },
      {
        development: {
          options: {
            optimization: false,
          },
        },
      }
    );
    cleanupPatch();
    return config;
  }
  return {};
};
