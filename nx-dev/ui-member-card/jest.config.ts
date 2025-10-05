/* eslint-disable */
export default {
  displayName: 'nx-dev-ui-member-card',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-member-card',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  preset: '../../jest.preset.js',
  moduleNameMapper: {
    // Override for nx-dev packages - point to packages directory
    '^@nx/devkit$': '<rootDir>/../../packages/devkit/index.ts',
    '^@nx/devkit/testing$': '<rootDir>/../../packages/devkit/testing.ts',
    '^@nx/devkit/internal-testing-utils$':
      '<rootDir>/../../packages/devkit/internal-testing-utils.ts',
    '^@nx/devkit/src/(.*)$': '<rootDir>/../../packages/devkit/src/$1',
  },
};
