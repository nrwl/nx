export default {
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  maxWorkers: 1,
  globals: {},
  globalSetup: '../../e2e/utils/global-setup.ts',
  globalTeardown: '../../e2e/utils/global-teardown.ts',
  displayName: 'e2e-graph-client',
  preset: '../../jest.preset.js',
};
