const path = require('path');

// Absolute paths to the physical source files inside `packages/nx`. Mocking
// by the `nx/src/...` specifier instead routes through the pnpm
// `node_modules/nx` symlink, which jest keys as a *different* module id
// from the relative imports inside `packages/nx` — so the mock is never
// applied on CI. Using the absolute physical path here guarantees both
// resolution chains hit the same registry entry.
const nxSrcPath = (relative) => {
  const base = path.resolve(__dirname, '..', 'packages/nx/src', relative);
  // Resolve to the actual source file. `jest.doMock` keys mocks by the path
  // that callers' module resolution produces — `.ts` for our source, or
  // `index.js` for the napi binding entry — so passing a bare directory or
  // extension-less path leaves callers' imports unmocked.
  for (const candidate of [base, `${base}.ts`, path.join(base, 'index.js')]) {
    try {
      const stat = require('fs').statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch (_) {}
  }
  return base;
};
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
   *
   * Skipped for `packages/nx` itself — `nx`'s own source code never imports
   * from `@nx/devkit` (devkit re-exports from nx, not vice versa), and the
   * relative-path mock for `nx/src/project-graph/project-graph` below
   * already covers nx's internal `createProjectGraphAsync` callers. Loading
   * devkit here just to spread `requireActual('@nx/devkit')` would pull
   * its entire source tree into the sandbox for no callers.
   */
  const isNxProject = process.env.NX_TASK_TARGET_PROJECT === 'nx';
  if (!isNxProject) {
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
  }

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
   * Guard: short-circuit `workspace-context` helpers when they're handed the
   * real workspace root. The native rust `WorkspaceContext` recursively walks
   * the workspace on construction, so any test that reaches these with the
   * real root scans the full monorepo and produces thousands of sandbox
   * violations. Tests that pass a `TempFs` root continue to hit the real
   * implementation.
   *
   * The actual culprit observed: `createFileMapUsingProjectGraph` reads the
   * imported `workspaceRoot` constant and calls `getAllFileDataInContext` on
   * it. Returning empty results for the real root gives every caller a safe
   * no-op without breaking tests that have synthetic file maps.
   */
  // Use plain functions (not `jest.fn`) so `jest.resetAllMocks()` in test
  // suites can't wipe these implementations and turn them into `() =>
  // undefined`, which would surface as "is not iterable" downstream.
  const workspaceContextPath = nxSrcPath('utils/workspace-context');
  jest.doMock(workspaceContextPath, () => {
    // Lazily resolve the real module on each call. Capturing it in the
    // factory closure produces an empty object on the first invocation
    // (jest's internal loader returns the in-progress `module.exports`
    // when `requireActual` re-enters the same module from inside the
    // mock factory).
    const realFn =
      (name) =>
      (...args) =>
        jest.requireActual(workspaceContextPath)[name](...args);
    const guarded =
      (name, fallback) =>
      (root, ...rest) => {
        if (root === realWorkspaceRoot) return fallback();
        return jest.requireActual(workspaceContextPath)[name](root, ...rest);
      };
    return {
      __esModule: true,
      setupWorkspaceContext: (root) => {
        if (root === realWorkspaceRoot) return;
        return jest
          .requireActual(workspaceContextPath)
          .setupWorkspaceContext(root);
      },
      getNxWorkspaceFilesFromContext: guarded(
        'getNxWorkspaceFilesFromContext',
        () =>
          Promise.resolve({
            projectFileMap: {},
            globalFiles: [],
            externalReferences: {},
          })
      ),
      globWithWorkspaceContext: guarded('globWithWorkspaceContext', () =>
        Promise.resolve([])
      ),
      globWithWorkspaceContextSync: guarded(
        'globWithWorkspaceContextSync',
        () => []
      ),
      multiGlobWithWorkspaceContext: guarded(
        'multiGlobWithWorkspaceContext',
        () => Promise.resolve([])
      ),
      hashWithWorkspaceContext: guarded('hashWithWorkspaceContext', () =>
        Promise.resolve('0')
      ),
      hashMultiGlobWithWorkspaceContext: guarded(
        'hashMultiGlobWithWorkspaceContext',
        () => Promise.resolve([])
      ),
      getAllFileDataInContext: guarded('getAllFileDataInContext', () =>
        Promise.resolve([])
      ),
      getFilesInDirectoryUsingContext: guarded(
        'getFilesInDirectoryUsingContext',
        () => Promise.resolve([])
      ),
      // Pass-through helpers that don't take a workspace root.
      updateContextWithChangedFiles: realFn('updateContextWithChangedFiles'),
      updateFilesInContext: realFn('updateFilesInContext'),
      updateProjectFiles: realFn('updateProjectFiles'),
      resetWorkspaceContext: realFn('resetWorkspaceContext'),
    };
  });

  /**
   * Backstop: short-circuit native rust functions that recursively walk a
   * directory when they're handed the real workspace root. The
   * `workspace-context` mock above catches the high-level callers, but
   * `expandOutputs` / `getFilesForOutputsBatch` are called directly from
   * `tasks-runner/cache.ts` (`_expandOutputs(outputs, workspaceRoot)`) and
   * miss that net — they construct nothing, but `expand_outputs` drives
   * `nx_walker(realWorkspaceRoot)` and surfaces as the same cross-project
   * violation set.
   */
  const nativePath = nxSrcPath('native');
  jest.doMock(nativePath, () => {
    const actual = jest.requireActual(nativePath);
    const RealWorkspaceContext = actual.WorkspaceContext;
    function GuardedWorkspaceContext(root, cacheDir) {
      if (root === realWorkspaceRoot) {
        throw new Error(
          '[unit-test-setup] WorkspaceContext was constructed with the real ' +
            'workspace root during a unit test. This triggers a recursive ' +
            'walk of the entire monorepo and causes sandbox violations. ' +
            'Check the stack trace for the caller and either mock it in the ' +
            'test, point the call at a TempFs root, or extend ' +
            'scripts/unit-test-setup.js.'
        );
      }
      return new RealWorkspaceContext(root, cacheDir);
    }
    GuardedWorkspaceContext.prototype = RealWorkspaceContext.prototype;
    const guardDirArg = (fn, fallback) =>
      function (directory, ...rest) {
        if (directory === realWorkspaceRoot) return fallback;
        return fn(directory, ...rest);
      };
    return {
      __esModule: true,
      ...actual,
      WorkspaceContext: GuardedWorkspaceContext,
      expandOutputs: guardDirArg(actual.expandOutputs, []),
      getFilesForOutputsBatch: guardDirArg(actual.getFilesForOutputsBatch, []),
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
    // Some test configs (e.g. tools/workspace-plugin) use the default jest
    // resolver, which does not read package `exports` maps. If a workspace
    // package locks down its `exports` map, `@nx/<pkg>/src/...` subpath
    // imports become unresolvable in those contexts. Skip the mock there —
    // those tests don't import the function anyway.
    try {
      require.resolve(specifier);
    } catch {
      return;
    }
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
  mockIsUsingTsSolutionSetup('@nx/js/internal');
  mockIsUsingTsSolutionSetup(
    '@nx/workspace/src/utilities/typescript/ts-solution-setup'
  );

  /**
   * Two helpers in `packages/nx/src/utils/` probe the filesystem via
   * `require.resolve` to find sibling Nx packages:
   *
   *  - `hasNxJsPlugin(projectRoot, workspaceRoot)` (in `has-nx-js-plugin.ts`)
   *    — checks whether `@nx/js` is installed so it can decide whether to
   *    inject the implicit `nx-release-publish` target on a
   *    `package.json`-based project.
   *  - `readModulePackageJsonWithoutFallbacks(specifier, paths)` (in
   *    `package-json.ts`) — reads a plugin's `package.json`. Used by
   *    `readPluginPackageJson`, `readExecutorJson`, and target normalization.
   *
   * In unit tests `__dirname` falls back to the real `packages/nx/src/utils`,
   * so even when callers pass a synthetic `workspaceRoot` like `/tmp/test`,
   * Node's resolver walks up to the real repo's pnpm-symlinked
   * `node_modules` and lands on `packages/<plugin>/package.json`. Each one
   * shows up as a sandbox-violating foreign read.
   *
   * Pin both behaviors:
   *   - `hasNxJsPlugin` → always `true`, matching the de-facto answer in
   *     this repo (and what tests expect — they assert the implicit
   *     target gets added).
   *   - `readModulePackageJsonWithoutFallbacks` → throw MODULE_NOT_FOUND for
   *     `@nx/*` lookups. Production callers (`readPluginPackageJson`,
   *     `readExecutorJson`, target normalization) all catch MODULE_NOT_FOUND
   *     and degrade gracefully.
   *
   * Scoped to `nx:test` only — these mocks target `packages/nx/src/utils/`
   * source files by absolute physical path and exist to neutralize nx's
   * own plugin-resolution probing. Applying them to other projects'
   * tests (rspack, webpack, jest, …) can interfere with legitimate
   * `@nx/*` lookups those test paths might exercise.
   */
  if (isNxProject) {
    const hasNxJsPluginPath = nxSrcPath('utils/has-nx-js-plugin');
    jest.doMock(hasNxJsPluginPath, () => ({
      __esModule: true,
      hasNxJsPlugin: () => true,
    }));

    const packageJsonPath = nxSrcPath('utils/package-json');
    jest.doMock(packageJsonPath, () => {
      const actual = jest.requireActual(packageJsonPath);
      return {
        __esModule: true,
        ...actual,
        readModulePackageJsonWithoutFallbacks: (
          moduleSpecifier,
          requirePaths
        ) => {
          if (moduleSpecifier && moduleSpecifier.startsWith('@nx/')) {
            const err = new Error(`Cannot find module '${moduleSpecifier}'`);
            err.code = 'MODULE_NOT_FOUND';
            throw err;
          }
          return actual.readModulePackageJsonWithoutFallbacks(
            moduleSpecifier,
            requirePaths
          );
        },
      };
    });
  }
};
