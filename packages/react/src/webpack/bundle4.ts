module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.webpack = webpack;

  return {
    ReactRefreshPlugin: require('@pmmmwh/react-refresh-webpack-plugin'),
    webpack,
  };
};
