/*
 * Babel preset to provide React support for Nx.
 */

module.exports = function (api: any, options: {}) {
  api.assertVersion(7);
  return {
    presets: [
      '@nrwl/web/babel',
      [require.resolve('@babel/preset-react'), { useBuiltIns: true }],
    ],
  };
};
