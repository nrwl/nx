/* eslint-disable */
module.exports = {
  displayName: 'workspace-plugin',
  preset: '../../jest.preset.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    // `nodenext` requires a `.js` specifier on relative imports; point them back
    // at the TypeScript sources jest actually loads.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageDirectory: '../../coverage/tools/workspace-plugin',
  // Override the workspace-wide resolver that redirects @nx/* imports to
  // packages/* source; this project is intended to consume the installed
  // versions of its dependencies, not the local monorepo sources.
  resolver: undefined,
};
