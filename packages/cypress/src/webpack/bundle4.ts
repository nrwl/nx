module.exports = function (useShim = true) {
  const webpack = require('webpack');
  webpack.close = (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  };

  return {
    webpack,
    nodeExternals: require('webpack-node-externals'),
    version: require('webpack/package.json').version,
  };
};
