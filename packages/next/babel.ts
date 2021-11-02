/*
 * Babel preset to provide Next.js support for Nx.
 */
module.exports = function (api, options) {
  api.assertVersion(7);
  return {
    presets: [['next/babel', options]],
    plugins: [
      [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
    ],
  };
};
