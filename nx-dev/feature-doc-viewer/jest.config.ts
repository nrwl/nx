const nxPreset = require('@nrwl/jest/preset').default;
export default {
  ...nxPreset,
  displayName: 'nx-dev-feature-doc-viewer',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/nx-dev/feature-doc-viewer',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};
