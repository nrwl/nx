module.exports = {
  displayName: 'eslint-rules',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/eslint-rules',
  moduleNameMapper: {
    '@eslint/eslintrc': '@eslint/eslintrc/dist/eslintrc-universal.cjs',
  },
};
