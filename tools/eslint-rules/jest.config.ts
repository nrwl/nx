export default {
  displayName: 'eslint-rules',

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
  preset: '../../jest.preset.js',
};
