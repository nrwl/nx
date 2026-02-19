/* eslint-disable */
module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'nx',
  preset: '../../jest.preset.js',
  resolver: './jest-resolver.js',
  // Ensure cargo insta snapshots do not get picked up by jest
  testPathIgnorePatterns: ['<rootDir>/src/native/tui'],
};
