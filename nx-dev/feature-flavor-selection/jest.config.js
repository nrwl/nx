module.exports = {
  displayName: 'nx-dev-feature-flavor-selection',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage//nx-dev/feature-flavor-selection',
};
