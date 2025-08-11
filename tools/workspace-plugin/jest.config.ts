/* eslint-disable */
export default {
  displayName: 'workspace-plugin',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/workspace-plugin',
  moduleNameMapper: {
    // Override for tools packages - point to packages directory
    '^@nx/devkit$': '<rootDir>/../../packages/devkit/index.ts',
    '^@nx/devkit/testing$': '<rootDir>/../../packages/devkit/testing.ts',
    '^@nx/devkit/internal-testing-utils$':
      '<rootDir>/../../packages/devkit/internal-testing-utils.ts',
    '^@nx/devkit/src/(.*)$': '<rootDir>/../../packages/devkit/src/$1',
    '^nx/src/devkit-exports$':
      '<rootDir>/../../packages/nx/src/devkit-exports.ts',
    '^nx/src/devkit-internals$':
      '<rootDir>/../../packages/nx/src/devkit-internals.ts',
    '^nx/src/devkit-testing-exports$':
      '<rootDir>/../../packages/nx/src/devkit-testing-exports.ts',
    '^@nx/eslint/src/(.*)$': '<rootDir>/../../packages/eslint/src/$1',
    '^nx/src/internal-testing-utils/(.*)$':
      '<rootDir>/../../packages/nx/src/internal-testing-utils/$1',
    '^nx/src/generators/(.*)$': '<rootDir>/../../packages/nx/src/generators/$1',
    '^nx/src/plugins/(.*)$': '<rootDir>/../../packages/nx/src/plugins/$1',
    '^nx/src/utils/(.*)$': '<rootDir>/../../packages/nx/src/utils/$1',
    '^nx/src/config/(.*)$': '<rootDir>/../../packages/nx/src/config/$1',
    '^nx/src/command-line/(.*)$':
      '<rootDir>/../../packages/nx/src/command-line/$1',
    '^nx/src/project-graph/(.*)$':
      '<rootDir>/../../packages/nx/src/project-graph/$1',
    '^nx/src/daemon/(.*)$': '<rootDir>/../../packages/nx/src/daemon/$1',
    '^nx/src/hasher/(.*)$': '<rootDir>/../../packages/nx/src/hasher/$1',
    '^nx/src/tasks-runner/(.*)$':
      '<rootDir>/../../packages/nx/src/tasks-runner/$1',
    '^nx/src/adapter/(.*)$': '<rootDir>/../../packages/nx/src/adapter/$1',
    '^nx/package.json$': '<rootDir>/../../packages/nx/package.json',
    '^@nx/js/src/(.*)$': '<rootDir>/../../packages/js/src/$1',
    '^@nx/plugin$': '<rootDir>/../../packages/plugin/index.ts',
    '^@nx/plugin/src/(.*)$': '<rootDir>/../../packages/plugin/src/$1',
  },
};
