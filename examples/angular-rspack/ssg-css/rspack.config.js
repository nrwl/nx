module.exports = (env) => {
  // @rspack/dev-server v2 dropped webpack-dev-server (which set WEBPACK_SERVE).
  // Bridge rspack 2's serve signal so createConfig detects serve mode.
  if (env?.['RSPACK_SERVE']) {
    process.env['WEBPACK_SERVE'] ??= 'true';
  }
  if (global.NX_GRAPH_CREATION === undefined) {
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
          prerender: true,
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
    return config;
  }
  return {};
};
