const nxPreset = require('@nrwl/jest/preset');
module.exports = {
  ...nxPreset,
  displayName: 'nx-dev-data-access-menu',
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/nx-dev/data-access-menu',
};
