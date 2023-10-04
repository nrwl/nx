/* eslint-disable */
export default {
  displayName: 'nx-dev-ui-common',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-common',
  preset: '../../jest.preset.js',
};
