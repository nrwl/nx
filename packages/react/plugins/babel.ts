import { Configuration } from 'webpack';
import { updateBabelOptions } from '../src/utils/babel-utils';

// Adds react preset for JSX support
function getBabelWebpackConfig(config: Configuration) {
  const babelRuleOptions = config.module.rules.find(
    r => r.loader === 'babel-loader'
  ).options as any;
  updateBabelOptions(babelRuleOptions);
  return config;
}

module.exports = getBabelWebpackConfig;
