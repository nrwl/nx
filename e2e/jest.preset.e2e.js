const preset = require('../jest.preset');

// The root preset sets up the environment for unit tests.
delete preset.setupFiles;
delete preset.moduleNameMapper;

module.exports = {
  ...preset,
};
