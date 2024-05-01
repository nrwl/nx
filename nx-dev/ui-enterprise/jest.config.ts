/* eslint-disable */
export default {
  displayName: 'nx-dev-ui-enterprise',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-enterprise',
  preset: '../../jest.preset.js',
};
