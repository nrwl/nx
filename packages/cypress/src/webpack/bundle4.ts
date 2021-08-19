module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.webpack = webpack;
  webpack.WebpackError = require('webpack/lib/WebpackError');

  return {
    webpack,
    nodeExternals: require('webpack-node-externals'),
    version: require('webpack/package.json').version,
  };
};
