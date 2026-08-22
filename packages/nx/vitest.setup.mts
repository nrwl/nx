/**
 * Vitest port of scripts/unit-test-setup.js (nx-project scope only) plus a
 * jest -> vi compat shim so unmigrated specs can run unchanged where the
 * APIs line up. Known gaps (counted as migration work, not shimmed):
 *  - jest.requireActual is sync; vi only offers async importActual.
 *  - jest.mock is not hoisted by vitest's transform; only vi.mock is.
 */
import { vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';

/**
 * nx source is full of lazy `require()` calls, which vitest executes with
 * real node require (they never enter vite's module graph). Install a TS
 * require hook so those calls can load .ts source, mirroring what jest's
 * CJS transform gave us for free. Caveat: modules loaded this way are
 * separate instances from vite-imported ones and do not see vi.mock.
 */
{
  // The register hook installs source-map-support, which overrides
  // Error.prepareStackTrace globally and mis-maps vite-transformed spec
  // frames (breaking vitest's error locations AND inline-snapshot updates,
  // which resolve call sites from stacks). Restore the original handler.
  const originalPrepareStackTrace = Error.prepareStackTrace;
  createRequire(import.meta.url)('@swc-node/register');
  Error.prepareStackTrace = originalPrepareStackTrace;
}

const realWorkspaceRoot = path.resolve(import.meta.dirname, '..', '..');

const nxSrcPath = (relative: string) => {
  const base = path.resolve(import.meta.dirname, 'src', relative);
  for (const candidate of [base, `${base}.ts`, path.join(base, 'index.js')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return base;
};

process.env.NX_DAEMON = 'false';
delete process.env.npm_config_user_agent;

// nx:run-commands injects FORCE_COLOR=true, which would put ANSI codes into
// snapshotted error output; snapshots are recorded colorless, so pin color
// detection off regardless of how the suite is invoked.
delete process.env.FORCE_COLOR;
process.env.NO_COLOR = '1';

// Guard: nothing in a unit test may write the real repo's nx.json. Surfaces
// the offending test with a stack instead of silently clobbering the file.
{
  const guardedTargets = new Set([
    path.join(realWorkspaceRoot, 'nx.json'),
    path.join(realWorkspaceRoot, 'package.json'),
  ]);
  // Patch the CJS fs object (ESM namespaces are frozen); this covers the
  // require channel that the source's lazy requires use.
  const cjsFs: any = createRequire(import.meta.url)('fs');
  const guard = (name: 'writeFileSync' | 'writeFile') => {
    const orig: any = cjsFs[name];
    cjsFs[name] = function (target: any, ...rest: any[]) {
      if (
        typeof target === 'string' &&
        guardedTargets.has(path.resolve(target))
      ) {
        throw new Error(
          `[vitest-setup] A test attempted to ${name} the real workspace file ${target}`
        );
      }
      return orig.call(this, target, ...rest);
    };
  };
  guard('writeFileSync');
  guard('writeFile');
}

const emptyProjectGraph = { nodes: {}, dependencies: {} };
const emptyProjectGraphAndMaps = {
  projectGraph: emptyProjectGraph,
  sourceMaps: {},
};

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
          '[vitest-setup] loadIsolatedNxPlugin called with the real workspace root'
        );
      }
      return actual.loadIsolatedNxPlugin(plugin, root, index);
    }),
  };
});

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

const nativePath = nxSrcPath('native');
vi.doMock(nativePath, async () => {
  const actual = await vi.importActual<any>(nativePath);
  const RealWorkspaceContext = actual.WorkspaceContext;
  function GuardedWorkspaceContext(root: string, cacheDir: string) {
    if (root === realWorkspaceRoot) {
      throw new Error(
        '[vitest-setup] WorkspaceContext constructed with the real workspace root'
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

vi.doMock(nxSrcPath('utils/has-nx-js-plugin'), () => ({
  hasNxJsPlugin: () => true,
}));

const packageJsonPath = nxSrcPath('utils/package-json');
vi.doMock(packageJsonPath, async () => {
  const actual = await vi.importActual<any>(packageJsonPath);
  return {
    ...actual,
    readModulePackageJsonWithoutFallbacks: (
      moduleSpecifier: string,
      requirePaths: string[]
    ) => {
      if (moduleSpecifier && moduleSpecifier.startsWith('@nx/')) {
        const err: any = new Error(`Cannot find module '${moduleSpecifier}'`);
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

// jest -> vi compat for unmigrated specs.
(globalThis as any).jest = vi;
