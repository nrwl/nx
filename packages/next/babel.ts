/*
 * Babel preset to provide Gatsby support for Nx.
 */
module.exports = function (api, options) {
  api.assertVersion(7);
  return {
    presets: ['next/babel'],
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
  };
};
