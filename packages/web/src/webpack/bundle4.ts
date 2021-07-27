module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.webpack = webpack;
  webpack.WebpackError = require('webpack/lib/WebpackError');

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
