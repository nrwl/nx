/* eslint-disable */
export default {
  displayName: 'nx-dev-data-access-documents',
  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/data-access-documents',
  preset: '../../jest.preset.js',
};
