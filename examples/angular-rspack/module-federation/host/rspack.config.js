module.exports = () => {
  const {
    ModuleFederationPlugin,
  } = require('@module-federation/enhanced/rspack');
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
        output: { uniqueName: mfConfig.name, publicPath: 'auto', module: true },
        optimization: {
          // the host keeps its runtime chunk under the dev server
          ...(process.env['RSPACK_SERVE'] ? {} : { runtimeChunk: false }),
          splitChunks: { cacheGroups: { default: false, common: false } },
        },
        plugins: [new ModuleFederationPlugin(mfConfig)],
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
  return config;
};
