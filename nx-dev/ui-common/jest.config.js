const nxPreset = require('@nrwl/jest/preset');
module.exports = {
  ...nxPreset,
  displayName: 'nx-dev-ui-common',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/ui-common',
};
