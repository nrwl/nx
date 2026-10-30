// yargs-parser@22 is ESM-only. Load the real implementation - `paths` keeps
// require.resolve off this mock, which moduleNameMapper would otherwise return.
const path = require('path');
const { loadEsm } = require('./load-esm-package');

module.exports = loadEsm(
  require.resolve('yargs-parser', {
    paths: [path.join(__dirname, '../../node_modules')],
  })
).default;
