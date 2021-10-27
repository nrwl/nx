const nxPreset = require('@nrwl/jest/preset');
module.exports = {
  ...nxPreset,
  displayName: 'nx-dev-feature-doc-viewer',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/feature-doc-viewer',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};
