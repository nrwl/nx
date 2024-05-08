/* eslint-disable */
export default {
  testEnvironment: 'jsdom',
  displayName: 'graph-project-details',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/graph/project-details',
};
