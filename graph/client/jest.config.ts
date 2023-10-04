/* eslint-disable */
// nx-ignore-next-line
const nxPreset = require('@nx/jest/preset').default;

export default {
  ...nxPreset,
  displayName: 'graph-client',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/nx-dev',
  // The mock for widnow.matchMedia has to be in a separete file and imported before the components to test
  // for more info check : // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
  modulePathIgnorePatterns: [
    '/graph/client/src/app/machines/match-media-mock.spec.ts',
  ],
};
