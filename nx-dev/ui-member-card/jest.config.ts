/* eslint-disable */
export default {
  displayName: 'nx-dev-ui-member-card',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-member-card',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  preset: '../../jest.preset.js',
};
