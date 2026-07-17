/* eslint-disable */
module.exports = {
  displayName: 'workspace-plugin',
  preset: '../../jest.preset.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/workspace-plugin',
  // Override the workspace-wide resolver that redirects @nx/* imports to
  // packages/* source; this project is intended to consume the installed
  // versions of its dependencies, not the local monorepo sources.
  resolver: undefined,
};
