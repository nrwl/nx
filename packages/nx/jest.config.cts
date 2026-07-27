/* eslint-disable */
module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'nx',
  preset: '../../jest.preset.js',
  resolver: './jest-resolver.js',
  // unbash is ESM-only, so let swc transform it rather than ignoring it
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm/)?unbash)'],
  // Ensure cargo insta snapshots do not get picked up by jest
  testPathIgnorePatterns: ['<rootDir>/src/native/tui'],
};
