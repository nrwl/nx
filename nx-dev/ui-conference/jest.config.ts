export default {
  displayName: 'nx-dev-ui-conference',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-conference',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  preset: '../../jest.preset.js',
};
