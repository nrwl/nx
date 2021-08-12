module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.webpack = webpack;

  return {
    webpack,
    nodeExternals: require('webpack-node-externals'),
    version: require('webpack/package.json').version,
  };
};
