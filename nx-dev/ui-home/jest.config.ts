export default {
  displayName: 'nx-dev-ui-home',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-home',
  preset: '../../jest.preset.js',
};
