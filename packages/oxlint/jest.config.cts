/* eslint-disable */
module.exports = {
  displayName: 'oxlint',
  preset: '../../jest.preset.js',
  globals: {},
  moduleFileExtensions: ['ts', 'js', 'html'],
  // No `moduleNameMapper` for this package's `.js` specifiers: the repo-wide
  // resolver in scripts/patched-jest-resolver.js already falls back to the
  // adjacent `.ts`, and it does so only after normal resolution fails rather
  // than rewriting every relative import.
  coverageDirectory: '../../coverage/packages/oxlint',
};
