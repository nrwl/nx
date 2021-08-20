module.exports = function (useShim = true) {
  return {
    nodeExternals: require('webpack-node-externals'),
  };
};
