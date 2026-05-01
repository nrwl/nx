module.exports = {
  name: 'examples-angular-rspack-mf-remote',
  /**
   * To use a remote that does not exist in your current Nx Workspace
   * You can use the tuple-syntax to define your remote
   *
   * remotes: [['my-external-remote', 'https://nx-angular-remote.netlify.app']]
   *
   * You _may_ need to add a `remotes.d.ts` file to your `src/` folder declaring the external remote for tsc, with the
   * following content:
   *
   * declare module 'my-external-remote';
   *
   */
  exposes: {
    './Routes': './src/app/remote-entry/entry.routes.ts',
  },
  shared: (libraryName) => {
    // This is specific to Nx Repo, otherwise dependencies that are irrelevant are considered and shared
    if (
      !libraryName.startsWith('@angular') &&
      !libraryName.startsWith('zone.js')
    ) {
      return false;
    }
  },
};
