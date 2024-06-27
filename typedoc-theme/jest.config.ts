const nxPreset = require('@nx/jest/preset').default;

/* eslint-disable */
export default {
  ...nxPreset,
  testTimeout: 35000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  coverageReporters: ['html'],
  maxWorkers: 1,
  testEnvironment: 'node',
  displayName: 'typedoc-theme',

  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  resolver: '../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../coverage/typedoc-theme',
  setupFiles: [],
};
