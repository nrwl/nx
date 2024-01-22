const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 30000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mts|mjs)$': 'ts-jest',
  },
  resolver: '../../../scripts/patched-jest-resolver.js',
  // Fixes https://github.com/jestjs/jest/issues/11956
  runtime: '@side/jest-runtime',
  moduleFileExtensions: ['ts', 'js', 'mts', 'html'],
  coverageReporters: ['html'],
  maxWorkers: 1,
};
