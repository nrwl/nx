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
  // The mock for widnow.matchMedia has to be in a separete file and imported before the components to test
  // for more info check : // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
  modulePathIgnorePatterns: [
    '/dep-graph/client/src/app/machines/match-media-mock.spec.ts',
  ],
};
