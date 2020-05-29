const pkg = require('../../package.json');

module.exports = {
  ...pkg.jest,
  globalSetup: '<rootDir>/local-registry/setup.js',
  globalTeardown: '<rootDir>/local-registry/teardown.js',
};
