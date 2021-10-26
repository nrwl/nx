const nxPreset = require('@nrwl/jest/preset');

module.exports = {
  ...nxPreset,
  displayName: 'nx-dev-ui-member-card',
  preset: '../../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/nx-dev/ui/member-card',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
};
