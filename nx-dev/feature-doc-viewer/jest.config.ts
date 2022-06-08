export default {
  displayName: 'nx-dev-feature-doc-viewer',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/feature-doc-viewer',
  preset: '../../jest.preset.js',
};
