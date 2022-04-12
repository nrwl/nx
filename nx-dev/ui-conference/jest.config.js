module.exports = {
  displayName: 'nx-dev-ui-conference',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-conference',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
};
