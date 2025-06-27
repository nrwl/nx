const preset = require('../jest.preset');

// The root preset sets up the environment for unit tests.
delete preset.setupFiles;

// Update moduleNameMapper paths for e2e directories (need to go up one more level to reach packages)
const updatedModuleNameMapper = {};
for (const [key, value] of Object.entries(preset.moduleNameMapper)) {
  // Replace <rootDir>/../ with <rootDir>/../../packages/ for e2e directories
  updatedModuleNameMapper[key] = value.replace(
    '<rootDir>/../',
    '<rootDir>/../../packages/'
  );
}

module.exports = {
  ...preset,
  moduleNameMapper: updatedModuleNameMapper,
};
