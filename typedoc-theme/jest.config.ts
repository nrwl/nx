/* eslint-disable */
export default {
  displayName: 'typedoc-theme',

  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  resolver: '../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../coverage/typedoc-theme',
  preset: '../jest.preset.js',
};
