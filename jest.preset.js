const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 35000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  // TODO: figure out why using the jest resolver causes:
  //    Cannot find module '@nx/nx-linux-x64-gnu' from '../../packages/nx/src/native/native-bindings.js'
  // resolver: '../../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
  maxWorkers: 1,
  testEnvironment: 'node',
};
