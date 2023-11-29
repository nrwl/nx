/* eslint-disable */
export default {
  displayName: 'tools-documentation-create-embeddings',
  preset: './jest.preset.js',
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mts|mjs)$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  transformIgnorePatterns: [
    // Ensure that Jest does not ignore github-slugger
    '<rootDir>/node_modules/.pnpm/(?!(github-slugger)@)',
  ],
  moduleFileExtensions: ['mts', 'ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/tools/documentation/create-embeddings',
};
