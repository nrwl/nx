/* eslint-disable */
export default {
  displayName: 'workspace-plugin',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/workspace-plugin',
  moduleNameMapper: {
    '^@nx/conformance$':
      '<rootDir>/../../node_modules/@nx/conformance/src/index.js',
  },
};
