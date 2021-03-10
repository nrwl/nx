/*
 * Babel preset to provide Gatsby support for Nx.
 */
module.exports = function (api, options) {
  api.assertVersion(7);
  return {
    presets: [
      '@nrwl/web/babel',
      [require.resolve('babel-preset-gatsby'), { useBuiltIns: true }],
    ],
  };
};
