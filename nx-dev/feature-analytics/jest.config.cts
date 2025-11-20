/* eslint-disable */
module.exports = {
  displayName: 'nx-dev-feature-analytics',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/feature-analytics',
  preset: '../../jest.preset.js',
};
