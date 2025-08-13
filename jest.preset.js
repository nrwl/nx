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
};
