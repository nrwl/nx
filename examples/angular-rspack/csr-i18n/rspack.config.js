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
          assets: [{ glob: '**/*', input: 'public' }],
          styles: ['./src/styles.css'],
          scripts: [],
          polyfills: ['zone.js', '@angular/localize/init'],
          browser: './src/main.ts',
          outputPath: {
            base: './dist',
          },
          tsConfig: './tsconfig.app.json',
          skipTypeChecking: false,
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
            outputHashing: 'all',
            localize: true,
          },
        },
      }
    );
    cleanupPatch();
    return config;
  }
  return {};
};
