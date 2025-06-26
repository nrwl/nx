/* eslint-disable */
export default {
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {},
  displayName: 'cli',
  preset: '../../jest.preset.js',
  moduleNameMapper: {
    // Map Angular schematics to node_modules
    '^@schematics/angular/collection.json$':
      '<rootDir>/../../node_modules/@schematics/angular/collection.json',
    '^@angular-devkit/schematics/tools$':
      '<rootDir>/../../node_modules/@angular-devkit/schematics/tools/index.js',
  },
};
