// Ensure that the preset loads from node_modules rather than our local typescript source
const nxPreset = require('./node_modules/@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 35000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: '../../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
  maxWorkers: 1,
  testEnvironment: 'node',
  setupFiles: ['../../scripts/unit-test-setup.js'],
  moduleNameMapper: {
    // TypeScript source mappings
    '^@nx/devkit$': '<rootDir>/../devkit/index.ts',
    '^@nx/devkit/testing$': '<rootDir>/../devkit/testing.ts',
    '^@nx/devkit/internal-testing-utils$':
      '<rootDir>/../devkit/internal-testing-utils.ts',
    '^@nx/devkit/src/(.*)$': '<rootDir>/../devkit/src/$1',
    '^nx/src/devkit-exports$': '<rootDir>/../nx/src/devkit-exports.ts',
    '^nx/src/devkit-internals$': '<rootDir>/../nx/src/devkit-internals.ts',
    '^nx/src/devkit-testing-exports$':
      '<rootDir>/../nx/src/devkit-testing-exports.ts',
    '^nx/src/internal-testing-utils/(.*)$':
      '<rootDir>/../nx/src/internal-testing-utils/$1',
    '^nx/src/generators/(.*)$': '<rootDir>/../nx/src/generators/$1',
    '^nx/src/plugins/(.*)$': '<rootDir>/../nx/src/plugins/$1',
    '^nx/src/utils/(.*)$': '<rootDir>/../nx/src/utils/$1',
    '^nx/src/config/(.*)$': '<rootDir>/../nx/src/config/$1',
    '^nx/src/command-line/(.*)$': '<rootDir>/../nx/src/command-line/$1',
    '^nx/src/project-graph/(.*)$': '<rootDir>/../nx/src/project-graph/$1',
    '^nx/src/daemon/(.*)$': '<rootDir>/../nx/src/daemon/$1',
    '^nx/src/utils/(.*)$': '<rootDir>/../nx/src/utils/$1',
    '^nx/src/hasher/(.*)$': '<rootDir>/../nx/src/hasher/$1',
    '^nx/src/tasks-runner/(.*)$': '<rootDir>/../nx/src/tasks-runner/$1',
    '^nx/src/adapter/(.*)$': '<rootDir>/../nx/src/adapter/$1',
    '^nx/package.json$': '<rootDir>/../nx/package.json',
    '^@nx/workspace$': '<rootDir>/../workspace/index.ts',
    // TS Solution: Map workspace packages to their TypeScript source
    '^@nx/rollup$': '<rootDir>/../rollup/index.ts',
    '^@nx/eslint$': '<rootDir>/../eslint/index.ts',
    '^@nx/vite$': '<rootDir>/../vite/index.ts',
    '^@nx/vite/src/(.*)$': '<rootDir>/../vite/src/$1',
    '^@nx/jest$': '<rootDir>/../jest/index.ts',
    '^@nx/js$': '<rootDir>/../js/src/index.ts',
    '^@nx/js/src/(.*)$': '<rootDir>/../js/src/$1',
    '^@nx/eslint/src/(.*)$': '<rootDir>/../eslint/src/$1',
    '^@nx/esbuild$': '<rootDir>/../esbuild/index.ts',
    '^@nx/react$': '<rootDir>/../react/index.ts',
    '^@nx/playwright/plugin$': '<rootDir>/../playwright/plugin.ts',
    '^@nx/rollup$': '<rootDir>/../rollup/index.ts',
    '^@nx/rspack$': '<rootDir>/../rspack/src/index.ts',
    '^@nx/plugin$': '<rootDir>/../plugin/index.ts',
    '^@nx/plugin/src/(.*)$': '<rootDir>/../plugin/src/$1',
  },
};
