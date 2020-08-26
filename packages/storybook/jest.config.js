module.exports = {
  name: 'storybook',
  preset: '../../jest.config.js',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: {
    'ts-jest': { tsConfig: '<rootDir>/tsconfig.spec.json' },
  },
};
