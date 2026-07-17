module.exports = () => {
  if (global.NX_GRAPH_CREATION === undefined) {
    const { createConfig } = require('@nx/angular-rspack');
    const config = createConfig(
      {
        options: {
          root: __dirname,
          index: './src/index.html',
          assets: [{ glob: '**/*', input: 'public' }],
          styles: ['./src/styles.css'],
          scripts: [],
          polyfills: ['@angular/localize/init'],
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
    return config;
  }
  return {};
};
