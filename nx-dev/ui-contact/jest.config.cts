/* eslint-disable */
module.exports = {
  displayName: 'nx-dev-ui-contact',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-contact',
  preset: '../../jest.preset.js',
};
