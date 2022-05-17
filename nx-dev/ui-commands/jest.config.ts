export default {
  displayName: 'nx-dev-ui-commands',

  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage//nx-dev/ui-commands',
  preset: '../../jest.preset.js',
};
