module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.close = (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  };

  return {
    ReactRefreshPlugin: require('@pmmmwh/react-refresh-webpack-plugin'),
    webpack,
  };
};
