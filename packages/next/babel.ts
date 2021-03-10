/*
 * Babel preset to provide Next.js support for Nx.
 */
module.exports = function (api, options) {
  api.assertVersion(7);
  return {
    presets: ['next/babel'],
    plugins: [
      [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
    ],
  };
};
