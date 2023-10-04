/* eslint-disable */
export default {
  displayName: 'nx-dev-data-access-packages',
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
  coverageDirectory: '../../coverage/nx-dev/data-access-packages',
  preset: '../../jest.preset.js',
};
