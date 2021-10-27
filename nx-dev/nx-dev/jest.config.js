const nxPreset = require('@nrwl/jest/preset');
module.exports = {
  ...nxPreset,
  displayName: 'nx-dev',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/nx-dev',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
};
