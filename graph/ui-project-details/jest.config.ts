/* eslint-disable */
export default {
  displayName: 'graph-ui-project-details',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/graph/graph-ui-project-details',
  moduleNameMapper: {
    // Override for graph packages - point to packages directory
    '^@nx/devkit$': '<rootDir>/../../packages/devkit/index.ts',
    '^@nx/devkit/testing$': '<rootDir>/../../packages/devkit/testing.ts',
    '^@nx/devkit/internal-testing-utils$':
      '<rootDir>/../../packages/devkit/internal-testing-utils.ts',
    '^@nx/devkit/src/(.*)$': '<rootDir>/../../packages/devkit/src/$1',
  },
};
