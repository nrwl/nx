module.exports = {
  displayName: 'e2e-maven',
  preset: '../jest.preset.e2e.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  globalSetup: '../utils/global-setup.ts',
  globalTeardown: '../utils/global-teardown.ts',
  testTimeout: 500000,
  maxWorkers: 1,
  coverageDirectory: '../../coverage/e2e/maven',
};
