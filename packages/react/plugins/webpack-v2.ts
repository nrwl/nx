import { Configuration, HotModuleReplacementPlugin } from 'webpack';
import * as ReactRefreshPlugin from '@pmmmwh/react-refresh-webpack-plugin';

// Add React-specific configuration
function getWebpackConfig(config: Configuration) {
  config.module.rules.push(
    {
      test: /\.(png|jpe?g|gif|webp)$/,
      loader: require.resolve('url-loader'),
      options: {
        limit: 10000, // 10kB
        name: '[name].[hash:7].[ext]',
      },
    },
    {
      test: /\.svg$/,
      oneOf: [
        // If coming from JS/TS file, then transform into React component using SVGR.
        {
          issuer: {
            test: /\.[jt]sx?$/,
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]',
                esModule: false,
              },
            },
          ],
        },
        // Fallback to plain URL loader.
        {
          use: [
            {
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]',
              },
            },
          ],
        },
      ],
    }
  );

  const isDevelopment = config.mode === 'development';

  // add `react-refresh/babel` to babel loader plugin
  const babelLoader = config.module.rules.find((rule) =>
    rule.loader.toString().includes('babel-loader')
  );
  babelLoader.options['plugins'] = [
    ...(babelLoader.options['plugins'] || []),
    isDevelopment && [
      require.resolve('react-refresh/babel'),
      { skipEnvCheck: true },
    ],
  ].filter(Boolean);

  // add https://github.com/pmmmwh/react-refresh-webpack-plugin to webpack plugin
  config.plugins.push(
    ...[
      isDevelopment && new HotModuleReplacementPlugin(),
      isDevelopment && new ReactRefreshPlugin(),
    ].filter(Boolean)
  );

  return config;
}

module.exports = getWebpackConfig;
