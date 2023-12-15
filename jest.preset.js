const { join } = require('path');

const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 35000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: join(__dirname, 'scripts/patched-jest-resolver.js'),
  // Fixes https://github.com/jestjs/jest/issues/11956
  runtime: '@side/jest-runtime',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
  maxWorkers: 1,
  testEnvironment: 'node',
  reporters: [join(__dirname, 'scripts/silent-jest-reporter.js'), 'summary'],
};
