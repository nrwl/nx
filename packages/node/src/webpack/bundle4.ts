module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.close = (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  };

  return {
    webpack,
    webpackMerge: require('webpack-merge'),
    CopyWebpackPlugin: require('copy-webpack-plugin'),
    nodeExternals: require('webpack-node-externals'),
  };
};
