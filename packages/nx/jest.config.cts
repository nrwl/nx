/* eslint-disable */
module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', dynamicImport: true },
          transform: {
            useDefineForClassFields: false,
          },
          experimental: {
            plugins: [['@swc-contrib/mut-cjs-exports', {}]],
          },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'nx',
  preset: '../../jest.preset.js',
  // Ensure cargo insta snapshots do not get picked up by jest
  testPathIgnorePatterns: ['<rootDir>/src/native/tui'],
};
