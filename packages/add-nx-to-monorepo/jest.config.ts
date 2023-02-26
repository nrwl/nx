/* eslint-disable */
export default {
  displayName: 'add-nx-to-monorepo',

  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsConfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/projects/add-nx-to-monorepo',
  preset: '../../jest.preset.js',
};
