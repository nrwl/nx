/* eslint-disable */
export default {
  displayName: 'workspace-plugin',
  // TODO: For some reason our patched jest resolve cannot work with @nx/powerpack-conformance
  // preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/workspace-plugin',
};
