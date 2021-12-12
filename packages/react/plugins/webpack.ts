import type { Configuration } from 'webpack';
import ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

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
          issuer: /\.[jt]sx?$/,
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

  if (config.mode === 'development' && config['devServer']?.hot) {
    // add `react-refresh/babel` to babel loader plugin
    const babelLoader = config.module.rules.find(
      (rule) =>
        typeof rule !== 'string' &&
        rule.loader?.toString().includes('babel-loader')
    );
    if (babelLoader && typeof babelLoader !== 'string') {
      babelLoader.options['plugins'] = [
        ...(babelLoader.options['plugins'] || []),
        [
          require.resolve('react-refresh/babel'),
          {
            skipEnvCheck: true,
          },
        ],
      ];
    }
    // add https://github.com/pmmmwh/react-refresh-webpack-plugin to webpack plugin
    config.plugins.push(new ReactRefreshPlugin());
  }

  return config;
}

module.exports = getWebpackConfig;
