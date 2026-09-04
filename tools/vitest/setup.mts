/**
 * Vitest port of `scripts/unit-test-setup.js` for packages whose unit tests
 * have moved off jest. Lives in a project (not at the workspace root) so vite
 * resolves it against this directory's leaf tsconfig instead of the root
 * solution file, whose `references` would pull in every project's tsconfig.
 * Loaded through each package's
 * `vitest.config.mts#test.setupFiles`; the guards it installs are the ones the
 * jest preset gave every project for free.
 *
 * `vi.doMock` (not `vi.mock`): this file is not a spec, so nothing hoists
 * here. Spec files are imported after setup runs, so their static imports
 * still see these mocks, and a spec's own `vi.mock` for the same module wins.
 *
 * There is deliberately no `jest` alias — a stray `jest.mock` in a migrated
 * spec must throw rather than silently fail to intercept.
 */
import { vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import { resolveNxSourceSpecifier } from './nx-source-resolver.mts';

const require = createRequire(import.meta.url);

/**
 * `@clack/prompts` drives a *synchronous* terminal prompt, so a generator that
 * asks a question blocks the worker forever — no test timeout can fire. The
 * jest preset mapped it to this stub, which answers `undefined` and lets the
 * generator take its default; specs override the stub to drive a prompt.
 */
const clackPromptsStub = path.join(
  import.meta.dirname,
  '..',
  '..',
  'scripts/jest-mocks/clack-prompts.js'
);

/**
 * Point node's `require` at this repo's source for `nx` and `@nx/*`, the way
 * the vite plugin does for imports. Without it the two channels disagree, and
 * `--conditions=@nx/nx-source` makes a lazy `require('@nx/js')` fail outright:
 * the *published* package in node_modules advertises a `@nx/nx-source` entry
 * pointing at source files its tarball does not ship.
 */
{
  const Module: any = require('node:module');
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: any[]) {
    if (request === '@clack/prompts') return clackPromptsStub;
    return (
      resolveNxSourceSpecifier(request) ??
      originalResolveFilename.call(this, request, ...rest)
    );
  };
}

vi.doMock('@clack/prompts', () => {
  const stub = require(clackPromptsStub);
  return { ...stub, default: stub };
});

/**
 * Source is full of lazy `require()` calls, which vitest executes with real
 * node require (they never enter vite's module graph). Install a TS require
 * hook so those calls can load .ts source, mirroring what jest's CJS
 * transform gave us for free. Caveat: modules loaded this way are separate
 * instances from vite-imported ones and do not see vi.mock.
 */
{
  // The register hook installs source-map-support, which overrides
  // Error.prepareStackTrace globally and mis-maps vite-transformed spec
  // frames (breaking vitest's error locations AND inline-snapshot updates,
  // which resolve call sites from stacks). Restore the original handler.
  const originalPrepareStackTrace = Error.prepareStackTrace;
  require('@swc-node/register');
  Error.prepareStackTrace = originalPrepareStackTrace;
}

const realWorkspaceRoot = path.resolve(import.meta.dirname, '..', '..');

/**
 * Absolute paths to the physical source files inside `packages/nx`. Mocking
 * by the `nx/src/...` specifier instead routes through the pnpm
 * `node_modules/nx` symlink, which keys as a *different* module id from the
 * relative imports inside `packages/nx` — so the mock is never applied.
 */
const nxSrcPath = (relative: string) => {
  const base = path.resolve(realWorkspaceRoot, 'packages/nx/src', relative);
  for (const candidate of [base, `${base}.ts`, path.join(base, 'index.js')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return base;
};

/**
 * When the daemon is enabled during unit tests and one is already running,
 * daemon-client hits the *installed* version of Nx, which does not know any
 * message type added in source since.
 */
process.env.NX_DAEMON = 'false';

/**
 * Package manager detection falls back to npm_config_user_agent when no
 * lockfile exists (the common case for in-memory test trees), so results
 * would depend on whether the suite was invoked through npm, pnpm, or yarn.
 */
delete process.env.npm_config_user_agent;

// nx:run-commands injects FORCE_COLOR=true, which would put ANSI codes into
// snapshotted output; snapshots are recorded colorless, so pin color
// detection off regardless of how the suite is invoked.
delete process.env.FORCE_COLOR;
process.env.NO_COLOR = '1';

/**
 * `patched-jest-resolver.js` pointed `workspaceRoot` at `tmp/unit` as a side
 * effect of being loaded. Keep that: source that reads the imported
 * `workspaceRoot` const must not land on the real repo.
 *
 * Per worker process, unlike jest: code that slips past the graph mocks takes
 * a file lock under the workspace data dir, and vitest's parallel workers
 * would serialize behind one shared lock (jest's `maxWorkers: 1` never had
 * two of them).
 */
if (!process.env.NX_WORKSPACE_ROOT_PATH) {
  const root = path.join(realWorkspaceRoot, 'tmp', 'unit', `${process.pid}`);
  fs.mkdirSync(root, { recursive: true });
  process.env.NX_WORKSPACE_ROOT_PATH = root;
}

/**
 * Plugin isolation spawns a worker subprocess per plugin. A caller that
 * reaches graph construction through a lazy `require()` misses the mocks
 * below — those only cover vite's module graph — and the workers it starts
 * stall the spec file to its timeout instead of being torn down.
 */
process.env.NX_ISOLATE_PLUGINS = 'false';

const emptyProjectGraph = { nodes: {}, dependencies: {} };
const emptyProjectGraphAndMaps = {
  projectGraph: emptyProjectGraph,
  sourceMaps: {},
};

/**
 * The same graph mocks, applied to the CJS require channel.
 *
 * `vi.mock` only covers vite's module graph, and generators reach graph
 * builders through lazy `require()`. Unmocked, `createProjectGraphAsync`
 * takes `project-graph.lock` and deadlocks the worker: no output, and no test
 * timeout can fire. Jest needed none of this — one registry served both
 * channels.
 */
{
  const Module: any = require('node:module');
  const originalLoad = Module._load;
  const patches = new Map<string, (actual: any) => any>();
  const patched = new Map<string, any>();

  const register = (
    specifier: string,
    patch: (actual: any) => Record<string, unknown>
  ) => {
    const filename = resolveNxSourceSpecifier(specifier);
    if (filename) patches.set(filename, patch);
  };

  const graphPatch = (actual: any) => ({
    ...actual,
    createProjectGraphAsync: async () => emptyProjectGraph,
    createProjectGraphAndSourceMapsAsync: async () => emptyProjectGraphAndMaps,
    buildProjectGraphAndSourceMapsWithoutDaemon: async () =>
      emptyProjectGraphAndMaps,
  });

  register('nx/src/project-graph/project-graph', graphPatch);
  register('@nx/devkit', (actual) => ({
    ...graphPatch(actual),
    // Resolve through the hook above, which finds this repo's source, rather
    // than installing the package into a temp dir.
    ensurePackage: (pkg: string) => require(pkg),
  }));

  Module._load = function (request: string, parent: any, isMain: boolean) {
    if (patches.size) {
      let filename: string | undefined;
      try {
        filename = Module._resolveFilename(request, parent, isMain);
      } catch {
        // fall through to the real loader for unresolvable specifiers
      }
      if (filename && patches.has(filename)) {
        if (!patched.has(filename)) {
          const actual = originalLoad.apply(this, arguments);
          patched.set(filename, patches.get(filename)!(actual));
        }
        return patched.get(filename);
      }
    }
    return originalLoad.apply(this, arguments);
  };
}

/**
 * An unmocked `createProjectGraphAsync` returns the Nx repo's own project
 * graph. No unit test should depend on the structure of this repo.
 */
vi.doMock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn(async () => emptyProjectGraph),
  /**
   * `ensurePackage` calls `require(pkg)`, which resolves from node_modules
   * (the installed version) instead of local source. Route it through the
   * swc-node require hook registered above, which honors the
   * `@nx/nx-source` condition from `execArgv`. It must stay synchronous —
   * generators call it inline — so `vi.importActual` is not an option.
   */
  ensurePackage: vi.fn((pkg: string) => require(pkg)),
}));

/**
 * Code inside `packages/nx` imports graph builders via relative paths, which
 * skip the `@nx/devkit` mock above.
 */
const projectGraphPath = nxSrcPath('project-graph/project-graph');
vi.doMock(projectGraphPath, async () => {
  const actual = await vi.importActual<any>(projectGraphPath);
  return {
    ...actual,
    createProjectGraphAsync: vi.fn(async () => emptyProjectGraph),
    createProjectGraphAndSourceMapsAsync: vi.fn(
      async () => emptyProjectGraphAndMaps
    ),
    buildProjectGraphAndSourceMapsWithoutDaemon: vi.fn(
      async () => emptyProjectGraphAndMaps
    ),
  };
});

/**
 * Guard: reaching plugin isolation pointed at the real workspace spawns a
 * plugin worker that scans the whole monorepo. Tests that exercise isolation
 * against a `TempFs` root pass through unchanged.
 */
const loadIsolatedPath = nxSrcPath(
  'project-graph/plugins/isolation/load-isolated-plugin'
);
vi.doMock(loadIsolatedPath, async () => {
  const actual = await vi.importActual<any>(loadIsolatedPath);
  return {
    ...actual,
    loadIsolatedNxPlugin: vi.fn((plugin, root, index) => {
      if (root === realWorkspaceRoot) {
        throw new Error(
          '[vitest-setup] loadIsolatedNxPlugin was called with the real ' +
            'workspace root during a unit test. Check the stack trace for ' +
            'the unmocked caller and either mock it in the test, point the ' +
            'call at a TempFs root, or extend scripts/vitest-setup.mts.'
        );
      }
      return actual.loadIsolatedNxPlugin(plugin, root, index);
    }),
  };
});

/**
 * Guard: the native rust `WorkspaceContext` recursively walks the workspace
 * on construction, so any test reaching these with the real root scans the
 * full monorepo. Plain functions, not `vi.fn`, so a suite's
 * `vi.resetAllMocks()` cannot wipe the implementations.
 */
const workspaceContextPath = nxSrcPath('utils/workspace-context');
vi.doMock(workspaceContextPath, async () => {
  const actual = await vi.importActual<any>(workspaceContextPath);
  const realFn =
    (name: string) =>
    (...args: any[]) =>
      actual[name](...args);
  const guarded =
    (name: string, fallback: () => any) =>
    (root: string, ...rest: any[]) => {
      if (root === realWorkspaceRoot) return fallback();
      return actual[name](root, ...rest);
    };
  return {
    setupWorkspaceContext: (root: string) => {
      if (root === realWorkspaceRoot) return;
      return actual.setupWorkspaceContext(root);
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
    updateContextWithChangedFiles: realFn('updateContextWithChangedFiles'),
    updateFilesInContext: realFn('updateFilesInContext'),
    updateProjectFiles: realFn('updateProjectFiles'),
    resetWorkspaceContext: realFn('resetWorkspaceContext'),
  };
});

/**
 * Backstop for the native functions `tasks-runner/cache.ts` calls directly,
 * which miss the `workspace-context` net above.
 */
const nativePath = nxSrcPath('native');
vi.doMock(nativePath, async () => {
  const actual = await vi.importActual<any>(nativePath);
  const RealWorkspaceContext = actual.WorkspaceContext;
  function GuardedWorkspaceContext(root: string, cacheDir: string) {
    if (root === realWorkspaceRoot) {
      throw new Error(
        '[vitest-setup] WorkspaceContext was constructed with the real ' +
          'workspace root during a unit test. This triggers a recursive walk ' +
          'of the entire monorepo. Check the stack trace for the caller and ' +
          'either mock it in the test or point the call at a TempFs root.'
      );
    }
    return new RealWorkspaceContext(root, cacheDir);
  }
  GuardedWorkspaceContext.prototype = RealWorkspaceContext.prototype;
  const guardDirArg = (fn: any, fallback: any) =>
    function (directory: string, ...rest: any[]) {
      if (directory === realWorkspaceRoot) return fallback;
      return fn(directory, ...rest);
    };
  return {
    ...actual,
    WorkspaceContext: GuardedWorkspaceContext,
    expandOutputs: guardDirArg(actual.expandOutputs, []),
    getFilesForOutputsBatch: guardDirArg(actual.getFilesForOutputsBatch, []),
  };
});

/**
 * `isUsingTsSolutionSetup()` falls back to `new FsTree(workspaceRoot, false)`
 * when called without a tree, reading the real repo's tsconfig. Short-circuit
 * to `true` (what hitting the real FS answers in this repo) so no test reads
 * from disk; calls that pass an explicit virtual tree run the real code.
 *
 * Mocked at the physical path: specs import it relatively, source imports it
 * through the package specifier, and only the resolved path is shared.
 */
const tsSolutionSetupPaths = [
  path.join(
    realWorkspaceRoot,
    'packages/workspace/src/utilities/typescript/ts-solution-setup.ts'
  ),
  path.join(
    realWorkspaceRoot,
    'packages/js/src/utils/typescript/ts-solution-setup.ts'
  ),
];
for (const specifier of tsSolutionSetupPaths) {
  if (!fs.existsSync(specifier)) continue;
  vi.doMock(specifier, async () => {
    const actual = await vi.importActual<any>(specifier);
    return {
      ...actual,
      isUsingTsSolutionSetup: vi.fn((tree?: any) =>
        tree ? actual.isUsingTsSolutionSetup(tree) : true
      ),
    };
  });
}
