/* eslint-disable */
module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'workspace',
  preset: '../../jest.preset.js',
  testEnvironment: '<rootDir>/jest-environment.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@rspack/core$': '<rootDir>/__mocks__/@rspack-core.js',
  },
};
