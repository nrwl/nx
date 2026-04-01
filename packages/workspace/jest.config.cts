/* eslint-disable */
module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'workspace',
  preset: '../../jest.preset.js',
  moduleNameMapper: {
    '^prettier$': '<rootDir>/jest-mocks/prettier.js',
  },
};
