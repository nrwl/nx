/* eslint-disable */
export default {
  displayName: 'e2e-rspack',
  preset: '../jest.preset.e2e.js',
  maxWorkers: 1,
  globals: {},
  globalSetup: '../utils/global-setup.ts',
  globalTeardown: '../utils/global-teardown.ts',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/e2e/e2e-rspack',
};
