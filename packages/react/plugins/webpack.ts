import { Configuration } from 'webpack';
import { updateBabelOptions } from '../src/utils/babel-utils';

// Add React-specific configuration
function getWebpackConfig(config: Configuration) {
  const idx = config.module.rules.findIndex(r => r.loader === 'babel-loader');
  const babelRuleOptions = config.module.rules[idx].options as any;
  updateBabelOptions(babelRuleOptions);

  config.module.rules.push(
    {
      test: /\.(png|jpe?g|gif|webp)$/,
      loader: 'url-loader',
      options: {
        limit: 10000, // 10kB
        name: '[name].[hash:7].[ext]'
      }
    },
    {
      test: /\.svg$/,
      oneOf: [
        // If coming from JS/TS file, then transform into React component using SVGR.
        {
          issuer: {
            test: /\.[jt]sx?$/
          },
          use: [
            '@svgr/webpack?-svgo,+titleProp,+ref![path]',
            {
              loader: 'url-loader',
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]'
              }
            }
          ]
        },
        // Fallback to plain URL loader.
        {
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]'
              }
            }
          ]
        }
      ]
    }
  );

  return config;
}

module.exports = getWebpackConfig;
