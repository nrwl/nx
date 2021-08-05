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
  };

  return {
    CopyWebpackPlugin: require('copy-webpack-plugin'),
    MiniCssExtractPlugin: require('mini-css-extract-plugin'),
    SourceMapLoader: require('source-map-loader'),
    TerserWebpackPlugin: require('terser-webpack-plugin'),
    webpackSources: require('webpack-sources'),
    webpack,
    webpackMerge: require('webpack-merge'),
  };
};
