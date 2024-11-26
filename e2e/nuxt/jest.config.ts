/* eslint-disable */
export default {
  displayName: 'e2e-nuxt',
  preset: '../jest.preset.e2e.js',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  maxWorkers: 1,
  globals: {},
  globalSetup: '../utils/global-setup.ts',
  globalTeardown: '../utils/global-teardown.ts',
};
