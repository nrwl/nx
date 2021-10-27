module.exports = {
  displayName: 'nx-dev-feature-versions-and-flavors',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage//nx-dev/feature-versions-and-flavors',
};
