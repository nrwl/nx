/* eslint-disable */
import nxPreset from '@nx/jest/preset';

module.exports = {
  ...nxPreset,
  displayName: 'nx-dev',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/nx-dev',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
};
