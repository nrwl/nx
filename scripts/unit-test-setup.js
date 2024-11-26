module.exports = () => {
  /**
   * When the daemon is enabled during unit tests,
   * and the daemon is already running, the daemon-client.ts
   * code will be used, but it will hit the already running
   * daemon which is from the installed version of Nx.
   *
   * In the vast majority of cases, this is fine. However,
   * if a new message type has been added to the daemon in
   * the source code, and isn't yet in the installed version,
   * any test that hits that codepath will fail. This is because
   * the installed version of the daemon doesn't know how to
   * handle the new message type.
   *
   * To prevent this, we disable the daemon during unit tests.
   */
  process.env.NX_DAEMON = 'false';

  /**
   * When `createProjectGraphAsync` is called during tests,
   * if its not mocked, it will return the Nx repo's project
   * graph. We don't want any unit tests to depend on the structure
   * of the Nx repo, so we mock it to return an empty project graph.
   */
  jest.doMock('@nx/devkit', () => ({
    ...jest.requireActual('@nx/devkit'),
    createProjectGraphAsync: jest.fn().mockImplementation(async () => {
      return {
        nodes: {},
        dependencies: {},
      };
    }),
  }));
};
