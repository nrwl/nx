const path = require('path');

// Absolute paths to the physical source files inside `packages/nx`. Mocking
// by the `nx/src/...` specifier instead routes through the pnpm
// `node_modules/nx` symlink, which jest keys as a *different* module id
// from the relative imports inside `packages/nx` — so the mock is never
// applied on CI. Using the absolute physical path here guarantees both
// resolution chains hit the same registry entry.
const nxSrcPath = (relative) =>
  path.resolve(__dirname, '..', 'packages/nx/src', relative);
const realWorkspaceRoot = path.resolve(__dirname, '..');

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

  const emptyProjectGraph = { nodes: {}, dependencies: {} };
  const emptyProjectGraphAndMaps = {
    projectGraph: emptyProjectGraph,
    sourceMaps: {},
  };

  /**
   * When `createProjectGraphAsync` is called during tests,
   * if its not mocked, it will return the Nx repo's project
   * graph. We don't want any unit tests to depend on the structure
   * of the Nx repo, so we mock it to return an empty project graph.
   */
  jest.doMock('@nx/devkit', () => ({
    __esModule: true,
    ...jest.requireActual('@nx/devkit'),
    createProjectGraphAsync: jest.fn(async () => emptyProjectGraph),
    /**
     * `ensurePackage` calls `require(pkg)` which resolves from node_modules
     * (the installed version) instead of the local source code. Using
     * `jest.requireActual` routes through Jest's module resolver which
     * respects tsconfig paths, so it picks up the source code instead.
     */
    ensurePackage: jest.fn((pkg) => jest.requireActual(pkg)),
  }));

  /**
   * Code inside `packages/nx` imports graph builders via relative paths
   * (`../../project-graph/project-graph`), which skip the `@nx/devkit`
   * mock above. Mock the source file at its absolute physical path so
   * those callers also get an empty graph.
   */
  const projectGraphPath = nxSrcPath('project-graph/project-graph');
  jest.doMock(projectGraphPath, () => {
    const actual = jest.requireActual(projectGraphPath);
    return {
      __esModule: true,
      ...actual,
      createProjectGraphAsync: jest.fn(async () => emptyProjectGraph),
      createProjectGraphAndSourceMapsAsync: jest.fn(
        async () => emptyProjectGraphAndMaps
      ),
      buildProjectGraphAndSourceMapsWithoutDaemon: jest.fn(
        async () => emptyProjectGraphAndMaps
      ),
    };
  });

  /**
   * Guard: if a unit test reaches plugin isolation pointed at the real
   * workspace, it spawns a `plugin-worker.ts` subprocess that scans the
   * whole monorepo and produces ~thousands of sandbox violations. Tests
   * that legitimately exercise plugin isolation against a `TempFs` root
   * (e.g. `getOnlyDefaultPlugins(tempFs.tempDir)`) pass through unchanged.
   */
  const loadIsolatedPath = nxSrcPath(
    'project-graph/plugins/isolation/load-isolated-plugin'
  );
  jest.doMock(loadIsolatedPath, () => {
    const actual = jest.requireActual(loadIsolatedPath);
    return {
      __esModule: true,
      ...actual,
      loadIsolatedNxPlugin: jest.fn((plugin, root, index) => {
        if (root === realWorkspaceRoot) {
          throw new Error(
            '[unit-test-setup] loadIsolatedNxPlugin was called with the real ' +
              'workspace root during a unit test. This spawns a real plugin ' +
              'worker that scans the entire monorepo and causes sandbox ' +
              'violations. Something reached real project-graph computation ' +
              'without hitting the @nx/devkit or project-graph mocks. Check ' +
              'the stack trace for the unmocked caller and either mock it in ' +
              'the test, point the call at a TempFs root, or extend ' +
              'scripts/unit-test-setup.js.'
          );
        }
        return actual.loadIsolatedNxPlugin(plugin, root, index);
      }),
    };
  });

  /**
   * `isUsingTsSolutionSetup()` falls back to `new FsTree(workspaceRoot, false)`
   * when called without a tree, which reads the real repo's `tsconfig.json` /
   * `tsconfig.base.json`. That surfaces as a sandbox violation for tests that
   * indirectly invoke it (cypress-preset, playwright-preset, plugin
   * `createNodesV2`, executor `normalize`, etc.).
   *
   * Unit tests should never touch the real workspace FS, so when the function
   * is called without a tree, short-circuit to `true`. `true` matches the
   * de-facto behavior of hitting the real FS (the Nx repo is a TS solution
   * workspace), preserving every test's existing expectations without
   * reading from disk. Calls that pass an explicit (virtual) tree still run
   * the real implementation.
   *
   * There are two copies of the function — one in `@nx/js` and one in
   * `@nx/workspace` — both need to be mocked.
   */
  const mockIsUsingTsSolutionSetup = (specifier) => {
    jest.doMock(specifier, () => {
      const actual = jest.requireActual(specifier);
      return {
        __esModule: true,
        ...actual,
        isUsingTsSolutionSetup: jest.fn((tree) =>
          tree ? actual.isUsingTsSolutionSetup(tree) : true
        ),
      };
    });
  };
  mockIsUsingTsSolutionSetup('@nx/js/src/utils/typescript/ts-solution-setup');
  mockIsUsingTsSolutionSetup(
    '@nx/workspace/src/utilities/typescript/ts-solution-setup'
  );
};
