export default {
  displayName: 'typedoc-theme',

  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  resolver: '../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../coverage/typedoc-theme',
  preset: '../jest.preset.js',
};
