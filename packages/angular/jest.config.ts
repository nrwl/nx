/* eslint-disable */
const swcRc = {
  jsc: {
    target: 'es2017',
    parser: {
      syntax: 'typescript',
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      decoratorMetadata: true,
      legacyDecorator: true,
      hidden: {
        jest: true,
      },
    },
    keepClassNames: true,
    externalHelpers: true,
    loose: true,
  },
  module: {
    type: 'commonjs',
    strict: true,
    noInterop: true,
  },
  sourceMaps: true,
  swcrc: false,
};
export default {
  transform: {
    // '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    '^.+\\.[tj]sx?$': ['@swc/jest', swcRc],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'angular',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
};
