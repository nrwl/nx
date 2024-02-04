/* eslint-disable */
export default {
  testEnvironment: 'jsdom',
  displayName: 'graph-ui-code-block',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/graph/ui-graph',
};
