const nxPreset = require('@nrwl/jest/preset').default;
export default {
  ...nxPreset,
  displayName: 'nx-dev-ui-common',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-common',
};
