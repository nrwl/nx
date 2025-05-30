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
  displayName: 'e2e-rollup',
  preset: '../jest.preset.e2e.js',
  reporters: [
    'default',
    [
      'jest-json-reporter2',
      {
        outputDir: __dirname,
        outputFile: 'test-results.json',
        fullOutput: true,
      },
    ],
  ],
};
