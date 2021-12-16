// nx-ignore-next-line
const nxPreset = require('@nrwl/jest/preset');

module.exports = {
  ...nxPreset,
  displayName: 'dep-graph-client',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/nx-dev',
};
