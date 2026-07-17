module.exports = () => {
  if (global.NX_GRAPH_CREATION === undefined) {
    const { createConfig } = require('@nx/angular-rspack');
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
          stylePreprocessorOptions: {
            includePaths: ['../shared/styles/src'],
          },
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
    return config;
  }
  return {};
};
