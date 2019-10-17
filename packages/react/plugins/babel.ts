import { Configuration } from 'webpack';
import { updateBabelOptions } from '../src/utils/babel-utils';

// Adds react preset for JSX support
function getBabelWebpackConfig(config: Configuration) {
  const idx = config.module.rules.findIndex(r => r.loader === 'babel-loader');
  const babelRuleOptions = config.module.rules[idx].options as any;
  updateBabelOptions(babelRuleOptions);

  // Converts SVG files into React components.
  config.module.rules.push({
    test: /\.svg$/,
    issuer: {
      test: /\.[jt]sx?$/
    },
    use: ['@svgr/webpack?-svgo,+titleProp,+ref![path]', 'url-loader']
  });

  return config;
}

module.exports = getBabelWebpackConfig;
