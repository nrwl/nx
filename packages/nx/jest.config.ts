/* eslint-disable */
export default {
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'nx',
  preset: '../../jest.preset.js',
  // Ensure cargo insta snapshots do not get picked up by jest
  testPathIgnorePatterns: ['<rootDir>/src/native'],
};
