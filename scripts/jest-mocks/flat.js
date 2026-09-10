// flat@6 is ESM-only. Load the real implementation - `paths` keeps
// require.resolve off this mock, which moduleNameMapper would otherwise return.
const path = require('path');
const { loadEsm } = require('./load-esm-package');

const flat = loadEsm(
  require.resolve('flat', {
    paths: [path.join(__dirname, '../../node_modules')],
  })
);

module.exports = { flatten: flat.flatten, unflatten: flat.unflatten };
