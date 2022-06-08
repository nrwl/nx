export default {
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html', 'json'],
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
  },
  displayName: 'react-native',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};
