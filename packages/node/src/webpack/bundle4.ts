module.exports = function (useShim = true) {
  const initialWebpack = require('webpack');
  const webpack = (config) => {
    const webpackInstance = initialWebpack(config);
    webpackInstance.close = (callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    };
    return webpackInstance;
  }

  return {
    webpack,
    webpackMerge: require('webpack-merge'),
    CopyWebpackPlugin: require('copy-webpack-plugin'),
    nodeExternals: require('webpack-node-externals'),
  };
};
