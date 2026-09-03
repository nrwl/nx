// ---------------------------------------------------------------------------
// Mock heavy dependencies before importing the module under test.
// existsSync is destructure-imported, so we must mock the whole module.
// ---------------------------------------------------------------------------

const existsSyncMock = vi.fn<boolean, [unknown]>(() => false);

vi.mock('node:fs', async () => ({
  ...require('node:fs'),
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
}));

vi.mock('../../plugins/js/utils/typescript', () => ({
  getRootTsConfigResolveExportsConditions: vi.fn(() => ['development']),
  getRootTsConfigCustomConditions: vi.fn(() => []),
}));

// Return a working packages-metadata mock so lookupLocalPlugin can resolve
// package names without needing tsconfig paths.
const entryPointsToProjectMapMock: Record<string, unknown> = {};

vi.mock('../../plugins/js/utils/packages', () => ({
  getWorkspacePackagesMetadata: vi.fn(() => ({
    entryPointsToProjectMap: entryPointsToProjectMapMock,
    wildcardEntryPointsToProjectMap: {},
    packageManagerWorkspacePackageNames: ['@proj/from-snapshot'],
  })),
  matchImportToWildcardEntryPointsToProjectMap: vi.fn(() => null),
}));

vi.mock('../../plugins/js/utils/register', () => ({
  refreshSourceGraphResolvers: vi.fn(),
}));

vi.mock('../../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

// Return a minimal tsconfig for tests that exercise the tsconfig-present path.
vi.mock('../../utils/fileutils', () => ({
  readJsonFile: vi.fn(() => ({ compilerOptions: { paths: {} } })),
}));

vi.mock('../../utils/logger', () => ({
  logger: { verbose: vi.fn(), error: vi.fn() },
}));

vi.mock('../../project-graph/utils/retrieve-workspace-files', () => ({
  retrieveProjectConfigurationsWithoutPluginInference: vi.fn(() =>
    Promise.resolve({})
  ),
  clearProjectsWithoutPluginInferenceCache: vi.fn(),
}));

vi.mock('../../project-graph/utils/find-project-for-path', () => ({
  findProjectForPath: vi.fn(() => null),
}));

import {
  getPluginPathAndName,
  resetResolvePluginCache,
  resolveNxPlugin,
} from './resolve-plugin';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const root = '/workspace';
const projectPath = `${root}/packages/my-plugin`;

function makeProject(exports: Record<string, unknown>): ProjectConfiguration {
  return {
    root: 'packages/my-plugin',
    targets: {},
    metadata: {
      js: {
        packageName: '@scope/my-plugin',
        packageExports: exports,
      },
    },
  } as any;
}

/** Register a project in the mock entry-points map and return the projects record. */
function setupProject(
  exports: Record<string, unknown>,
  subpaths: string[] = []
): Record<string, ProjectConfiguration> {
  const project = makeProject(exports);
  // Clear and repopulate the shared map object.
  for (const key of Object.keys(entryPointsToProjectMapMock)) {
    delete entryPointsToProjectMapMock[key];
  }
  entryPointsToProjectMapMock['@scope/my-plugin'] = project;
  for (const sub of subpaths) {
    entryPointsToProjectMapMock[sub] = project;
  }
  return { 'packages/my-plugin': project };
}

/** Make existsSyncMock return true only for the given set of absolute paths. */
function onlyFilesExist(...files: string[]) {
  existsSyncMock.mockImplementation((p: unknown) => files.includes(String(p)));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveSubpathFromExports (via getPluginPathAndName)', () => {
  beforeEach(() => {
    // Default: tsconfig exists (tests exercise the tsconfig-present path), nothing else.
    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      return s.endsWith('tsconfig.base.json') || s.endsWith('tsconfig.json');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves subpath when a custom source condition is present', () => {
    const sourceFile = `${projectPath}/src/plugins/cypress/plugin.ts`;
    onlyFilesExist(`${root}/tsconfig.base.json`, sourceFile);

    const projects = setupProject(
      {
        './cypress': {
          development: './src/plugins/cypress/plugin.ts',
          default: './dist/plugins/cypress/plugin.js',
        },
      },
      ['@scope/my-plugin/cypress']
    );

    const { pluginPath } = getPluginPathAndName(
      '@scope/my-plugin/cypress',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(pluginPath).toBe(sourceFile);
  });

  it('resolves subpath whose exports only declare types/import/default pointing at source files', () => {
    // Regression for the false-positive introduced by PR #35631:
    // source-only packages have no dist; their `default` condition points at
    // the .ts source file.  The old collision guard incorrectly returned null
    // and caused a hard-fail even though the file exists on disk.
    const sourceFile = `${projectPath}/src/plugin/index.ts`;
    onlyFilesExist(`${root}/tsconfig.base.json`, sourceFile);

    const projects = setupProject(
      {
        './plugin': {
          types: './src/plugin/index.ts',
          import: './src/plugin/index.ts',
          default: './src/plugin/index.ts',
        },
      },
      ['@scope/my-plugin/plugin']
    );

    const { pluginPath } = getPluginPathAndName(
      '@scope/my-plugin/plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    // Should resolve to the source file, not hard-fail.
    expect(pluginPath).toBe(sourceFile);
  });

  it('throws an informative error when the resolved file does not exist on disk', () => {
    // existsSync returns false for everything (except tsconfig).
    // resolveSubpathFromExports returns null, require.resolve also fails →
    // getPluginPathAndName should throw the guided "Unable to resolve" error.
    const projects = setupProject(
      {
        './plugin': {
          default: './dist/plugin/index.js',
        },
      },
      ['@scope/my-plugin/plugin']
    );

    expect(() =>
      getPluginPathAndName(
        '@scope/my-plugin/plugin',
        [`${root}/node_modules`],
        projects,
        root
      )
    ).toThrow(/Unable to resolve local plugin/);
  });

  it('resolves a local plugin when the workspace has no root tsconfig', () => {
    // Workspaces wired purely through package-manager workspaces +
    // package.json exports have no tsconfig.base.json/tsconfig.json at the
    // root. Local plugin lookup must fall through to the package-metadata
    // matching instead of throwing and failing every local plugin load.
    resetResolvePluginCache();
    const distFile = `${projectPath}/dist/plugin/index.js`;
    // No tsconfig exists anywhere — only the built plugin file.
    onlyFilesExist(distFile);

    const projects = setupProject(
      {
        './plugin': { default: './dist/plugin/index.js' },
      },
      ['@scope/my-plugin/plugin']
    );

    const { pluginPath } = getPluginPathAndName(
      '@scope/my-plugin/plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(pluginPath).toBe(distFile);
  });

  it('resolves the bare package name through the exports root entry when there is no build main', () => {
    const sourceFile = `${projectPath}/src/index.ts`;
    onlyFilesExist(`${root}/tsconfig.base.json`, sourceFile);

    const projects = setupProject({
      '.': {
        development: './src/index.ts',
        default: './dist/index.js',
      },
    });

    const result = getPluginPathAndName(
      '@scope/my-plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(sourceFile);
    expect(result.isSourcePlugin).toBe(true);
  });

  it('resolves the bare package name to the built entry when the exports root entry only points at dist', () => {
    const distFile = `${projectPath}/dist/index.js`;
    onlyFilesExist(`${root}/tsconfig.base.json`, distFile);

    const projects = setupProject({
      '.': { default: './dist/index.js' },
    });

    const result = getPluginPathAndName(
      '@scope/my-plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(distFile);
    expect(result.isSourcePlugin).toBe(false);
  });

  it('resolves a dual package bare name to the require target, as the loader requires first', () => {
    const cjsFile = `${projectPath}/dist/index.cjs`;
    onlyFilesExist(
      `${root}/tsconfig.base.json`,
      cjsFile,
      `${projectPath}/dist/index.mjs`
    );

    const projects = setupProject({
      '.': { import: './dist/index.mjs', require: './dist/index.cjs' },
    });

    const result = getPluginPathAndName(
      '@scope/my-plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(cjsFile);
    expect(result.isSourcePlugin).toBe(false);
  });

  it('resolves an import-only subpath entry, which the loader reaches through import()', () => {
    const esmFile = `${projectPath}/src/plugin.mjs`;
    onlyFilesExist(`${root}/tsconfig.base.json`, esmFile);

    const projects = setupProject(
      { './plugin': { import: './src/plugin.mjs' } },
      ['@scope/my-plugin/plugin']
    );

    const { pluginPath } = getPluginPathAndName(
      '@scope/my-plugin/plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(pluginPath).toBe(esmFile);
  });

  it('resolves a dual package subpath to the require target', () => {
    const cjsFile = `${projectPath}/dist/plugin.cjs`;
    onlyFilesExist(
      `${root}/tsconfig.base.json`,
      cjsFile,
      `${projectPath}/dist/plugin.mjs`
    );

    const projects = setupProject(
      {
        './plugin': {
          import: './dist/plugin.mjs',
          require: './dist/plugin.cjs',
        },
      },
      ['@scope/my-plugin/plugin']
    );

    const { pluginPath } = getPluginPathAndName(
      '@scope/my-plugin/plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(pluginPath).toBe(cjsFile);
  });

  it('does not mark a built file as source when the conditioned array target falls through to it', () => {
    const distFile = `${projectPath}/dist/index.js`;
    onlyFilesExist(`${root}/tsconfig.base.json`, distFile);

    for (const defaultTarget of [
      './dist/index.js',
      ['./dist/missing.js', './dist/index.js'],
    ]) {
      const projects = setupProject({
        '.': {
          development: ['./src/missing.ts', './dist/index.js'],
          default: defaultTarget,
        },
      });

      const result = getPluginPathAndName(
        '@scope/my-plugin',
        [`${root}/node_modules`],
        projects,
        root
      );

      expect(result.pluginPath).toBe(distFile);
      expect(result.isSourcePlugin).toBe(false);
    }
  });

  it('throws an informative error when the subpath has no exports entry', () => {
    const projects = setupProject(
      {
        '.': { default: './src/index.ts' },
        // No './nonexistent' entry
      },
      ['@scope/my-plugin/nonexistent']
    );

    expect(() =>
      getPluginPathAndName(
        '@scope/my-plugin/nonexistent',
        [`${root}/node_modules`],
        projects,
        root
      )
    ).toThrow(/Unable to resolve local plugin/);
  });
});

describe('getPluginPathAndName', () => {
  beforeEach(() => {
    resetResolvePluginCache();
    existsSyncMock.mockImplementation(() => false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks a relative workspace TypeScript plugin as source', () => {
    const workspace = resolve(__dirname, '../../..');

    const result = getPluginPathAndName(
      './resolve-plugin.ts',
      [__dirname],
      {},
      workspace
    );

    expect(result.pluginPath).toBe(join(__dirname, 'resolve-plugin.ts'));
    expect(result.isSourcePlugin).toBe(true);
  });
});

describe('resolveNxPlugin', () => {
  beforeEach(() => {
    resetResolvePluginCache();
    existsSyncMock.mockImplementation(() => false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pushes package names to source graph resolvers only when the workspace snapshot is rebuilt', async () => {
    const { refreshSourceGraphResolvers } =
      await import('../../plugins/js/utils/register');

    await expect(
      resolveNxPlugin('@scope/missing-plugin', root, [])
    ).rejects.toThrow();

    expect(refreshSourceGraphResolvers).toHaveBeenCalledTimes(1);
    const [refreshedRoot, getPackageNames] = vi.mocked(
      refreshSourceGraphResolvers
    ).mock.calls[0];
    expect(refreshedRoot).toBe(root);
    expect(getPackageNames?.()).toEqual(['@proj/from-snapshot']);

    await expect(
      resolveNxPlugin('@scope/missing-plugin', root, [])
    ).rejects.toThrow();
    expect(refreshSourceGraphResolvers).toHaveBeenCalledTimes(1);
  });

  it('extracts workspace package metadata once per resolution snapshot', async () => {
    const { getWorkspacePackagesMetadata } =
      await import('../../plugins/js/utils/packages');

    await expect(
      resolveNxPlugin('@scope/missing-plugin', root, [])
    ).rejects.toThrow();
    for (let i = 0; i < 3; i++) {
      await resolveNxPlugin('./resolve-plugin.ts', root, [__dirname]);
    }
    expect(getWorkspacePackagesMetadata).toHaveBeenCalledTimes(1);

    resetResolvePluginCache();
    await expect(
      resolveNxPlugin('@scope/missing-plugin', root, [])
    ).rejects.toThrow();
    expect(getWorkspacePackagesMetadata).toHaveBeenCalledTimes(2);
  });
});
