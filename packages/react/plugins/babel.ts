import { Configuration } from 'webpack';

// Adds react preset for JSX support
function getBabelWebpackConfig(config: Configuration) {
  const babelRuleOptions = config.module.rules.find(
    r => r.loader === 'babel-loader'
  ).options as any;

  const idx = babelRuleOptions.presets.findIndex(
    p => Array.isArray(p) && p[0].indexOf('@babel/preset-env') !== -1
  );

  babelRuleOptions.presets.splice(idx + 1, 0, [
    '@babel/preset-react',
    {
      useBuiltIns: true
    }
  ]);

  return config;
}

module.exports = getBabelWebpackConfig;
