/* eslint-disable */
module.exports = {
  displayName: 'oxlint',
  preset: '../../jest.preset.js',
  globals: {},
  moduleFileExtensions: ['ts', 'js', 'html'],
  // This package is ESM, so relative imports carry `.js` extensions. Jest
  // resolves against the TypeScript sources, which have none.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageDirectory: '../../coverage/packages/oxlint',
};
