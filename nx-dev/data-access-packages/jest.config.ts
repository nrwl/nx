const nxPreset = require('@nrwl/jest/preset');
module.exports = {
  ...nxPreset,
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  displayName: 'nx-dev-data-access-packages',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/data-access-packages',
};
