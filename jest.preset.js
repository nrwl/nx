const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 30000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: '../../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
  maxWorkers: 1,
};
