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
    ReactRefreshPlugin: require('@pmmmwh/react-refresh-webpack-plugin'),
    webpack,
  };
};
