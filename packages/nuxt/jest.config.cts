/* eslint-disable */
module.exports = {
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  displayName: 'nuxt',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/packages/nuxt',
};
