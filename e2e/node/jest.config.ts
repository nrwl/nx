/* eslint-disable */
export default {
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  maxWorkers: 1,
  globals: {},
  globalSetup: '../utils/global-setup.ts',
  globalTeardown: '../utils/global-teardown.ts',
  displayName: 'e2e-node',
  preset: '../../jest.preset.js',
};
