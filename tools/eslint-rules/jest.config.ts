/* eslint-disable */
export default {
  displayName: 'eslint-rules',

  globals: {},
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  preset: '../../jest.preset.js',
  moduleNameMapper: {
    // Override for tools packages - point to packages directory
    '^@nx/devkit$': '<rootDir>/../../packages/devkit/index.ts',
    '^@nx/devkit/testing$': '<rootDir>/../../packages/devkit/testing.ts',
    '^@nx/devkit/internal-testing-utils$':
      '<rootDir>/../../packages/devkit/internal-testing-utils.ts',
    '^@nx/devkit/src/(.*)$': '<rootDir>/../../packages/devkit/src/$1',
  },
};
