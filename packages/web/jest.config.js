module.exports = {
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  reporters: [
    'default',
    [
      'jest-junit',
      {
        suiteName: 'web',
        outputDirectory: 'reports/jest/web',
        outputName: 'web.xml',
      },
    ],
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: { 'ts-jest': { tsConfig: '<rootDir>/tsconfig.spec.json' } },
  displayName: 'web',
};
