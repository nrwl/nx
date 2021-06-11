const nxPreset = require('@nrwl/jest/preset');

process.env.npm_config_registry = `http://localhost:4872`;
process.env.YARN_REGISTRY = `http://localhost:4872`;

module.exports = {
  ...nxPreset,
  testRunner: 'jest-circus/runner',
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
