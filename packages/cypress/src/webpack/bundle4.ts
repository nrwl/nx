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
    webpack,
    nodeExternals: require('webpack-node-externals'),
    version: require('webpack/package.json').version,
  };
};
