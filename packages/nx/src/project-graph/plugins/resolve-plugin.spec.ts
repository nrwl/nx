// ---------------------------------------------------------------------------
// Mock heavy dependencies before importing the module under test.
// existsSync is destructure-imported, so we must mock the whole module.
// ---------------------------------------------------------------------------

const existsSyncMock = vi.hoisted(() => vi.fn<boolean, [unknown]>(() => false));

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
  setWorkspaceRoot: vi.fn(),
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
import { findProjectForPath } from '../../project-graph/utils/find-project-for-path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { mkdirSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const root = '/workspace';
const projectPath = `${root}/packages/my-plugin`;

function makeProject(
  exports: Record<string, unknown>,
  config: Partial<ProjectConfiguration> = {}
): ProjectConfiguration {
  return {
    root: 'packages/my-plugin',
    targets: {},
    metadata: {
      js: {
        packageName: '@scope/my-plugin',
        packageExports: exports,
      },
    },
    ...config,
  } as any;
}

/** Register a project in the mock entry-points map and return the projects record. */
function setupProject(
  exports: Record<string, unknown>,
  subpaths: string[] = [],
  config: Partial<ProjectConfiguration> = {}
): Record<string, ProjectConfiguration> {
  const project = makeProject(exports, config);
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

describe('tsconfig path mapped plugin entries (via getPluginPathAndName)', () => {
  async function mapPluginTo(file: string) {
    resetResolvePluginCache();
    const { readJsonFile } = await import('../../utils/fileutils');
    const { findProjectForPath } =
      await import('../../project-graph/utils/find-project-for-path');
    vi.mocked(readJsonFile).mockReturnValue({
      compilerOptions: { paths: { '@scope/my-plugin': [file] } },
    });
    vi.mocked(findProjectForPath).mockReturnValue('my-plugin');
    onlyFilesExist(`${root}/tsconfig.base.json`, `${root}/${file}`);
  }

  afterEach(async () => {
    const { readJsonFile } = await import('../../utils/fileutils');
    const { findProjectForPath } =
      await import('../../project-graph/utils/find-project-for-path');
    vi.mocked(readJsonFile).mockReturnValue({ compilerOptions: { paths: {} } });
    vi.mocked(findProjectForPath).mockReturnValue(null);
    resetResolvePluginCache();
    vi.clearAllMocks();
  });

  it('treats a mapped JavaScript file under a declared build output as built', async () => {
    await mapPluginTo('packages/my-plugin/dist/index.js');
    const projects = setupProject({}, [], {
      name: 'my-plugin',
      sourceRoot: 'packages/my-plugin/src',
      targets: { build: { outputs: ['{projectRoot}/dist'] } },
    });

    const result = getPluginPathAndName(
      '@scope/my-plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(`${projectPath}/dist/index.js`);
    expect(result.isSourcePlugin).toBe(false);
  });

  it('treats a mapped TypeScript file as source', async () => {
    await mapPluginTo('packages/my-plugin/src/index.ts');
    const projects = setupProject({}, [], { name: 'my-plugin' });

    const result = getPluginPathAndName(
      '@scope/my-plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(`${projectPath}/src/index.ts`);
    expect(result.isSourcePlugin).toBe(true);
  });
});

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

  it('resolves an import-only subpath entry under sourceRoot as source, which the loader reaches through import()', () => {
    const esmFile = `${projectPath}/src/plugin.mjs`;
    onlyFilesExist(`${root}/tsconfig.base.json`, esmFile);

    const projects = setupProject(
      { './plugin': { import: './src/plugin.mjs' } },
      ['@scope/my-plugin/plugin'],
      { sourceRoot: 'packages/my-plugin/src' }
    );

    const result = getPluginPathAndName(
      '@scope/my-plugin/plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(esmFile);
    expect(result.isSourcePlugin).toBe(true);
  });

  it('resolves a default-only JavaScript subpath entry under the build outputPath as built, even inside sourceRoot', () => {
    const distFile = `${projectPath}/dist/plugin.mjs`;
    onlyFilesExist(`${root}/tsconfig.base.json`, distFile);

    const projects = setupProject(
      { './plugin': { import: './dist/plugin.mjs' } },
      ['@scope/my-plugin/plugin'],
      {
        sourceRoot: 'packages/my-plugin',
        targets: {
          build: { options: { outputPath: 'packages/my-plugin/dist' } },
        },
      }
    );

    const result = getPluginPathAndName(
      '@scope/my-plugin/plugin',
      [`${root}/node_modules`],
      projects,
      root
    );

    expect(result.pluginPath).toBe(distFile);
    expect(result.isSourcePlugin).toBe(false);
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

  describe('path-registered JavaScript plugins', () => {
    let fs: TempFs;
    const projects: Record<string, ProjectConfiguration> = {
      plugin: {
        name: 'plugin',
        root: 'packages/plugin',
        sourceRoot: 'packages/plugin/src',
        targets: { build: { outputs: ['{projectRoot}/dist'] } },
      },
      // Generates into the plugin's sourceRoot.
      codegen: {
        name: 'codegen',
        root: 'packages/codegen',
        targets: {
          gen: { outputs: ['{workspaceRoot}/packages/plugin/src/generated'] },
        },
      },
    };

    beforeEach(() => {
      fs = new TempFs('resolve-plugin-relative-js', false);
      fs.createFilesSync({
        'packages/plugin/src/plugin.mjs': '',
        'packages/plugin/src/plugin.js': '',
        'packages/plugin/src/generated/index.js': '',
        'packages/plugin/dist/plugin.js': '',
        'tools/plugin.mjs': '',
      });
      vi.mocked(findProjectForPath).mockImplementation(
        (file: string) =>
          Object.values(projects).find((p) => file.startsWith(p.root + '/'))
            ?.name ?? null
      );
    });

    afterEach(() => {
      vi.mocked(findProjectForPath).mockImplementation(() => null);
      fs.cleanup();
    });

    const load = (specifier: string) =>
      getPluginPathAndName(specifier, [fs.tempDir], projects, fs.tempDir);

    it('classifies a file under the containing project sourceRoot as source', () => {
      const result = load('./packages/plugin/src/plugin.mjs');

      expect(result.isSourcePlugin).toBe(true);
      expect(result.projectRoot).toBe('packages/plugin');
    });

    it('classifies a relative JavaScript plugin under an aliased sourceRoot as source', () => {
      const alias = join(fs.tempDir, 'alias');
      symlinkSync(fs.tempDir, alias, 'dir');

      const result = getPluginPathAndName(
        './packages/plugin/src/plugin.js',
        [alias],
        projects,
        alias
      );

      expect(result.pluginPath).toBe(
        join(fs.tempDir, 'packages/plugin/src/plugin.js')
      );
      expect(result.isSourcePlugin).toBe(true);
      expect(result.projectRoot).toBe('packages/plugin');
    });

    it('retains the output producer under an aliased workspace root', () => {
      const alias = join(fs.tempDir, 'alias');
      symlinkSync(fs.tempDir, alias, 'dir');

      const result = getPluginPathAndName(
        './packages/plugin/src/generated/index.js',
        [alias],
        projects,
        alias
      );

      expect(result.isSourcePlugin).toBe(false);
      expect(result.projectRoot).toBe('packages/codegen');
    });

    it('keeps a file under a declared output built, whichever project declares it', () => {
      const own = load('./packages/plugin/dist/plugin.js');
      expect(own.isSourcePlugin).toBe(false);
      expect(own.projectRoot).toBe('packages/plugin');

      // The producer owns the entry for diagnostics, not the directory.
      const generated = load('./packages/plugin/src/generated/index.js');
      expect(generated.isSourcePlugin).toBe(false);
      expect(generated.projectRoot).toBe('packages/codegen');
    });

    it.each([false, true])(
      'keeps a relative plugin under a symlinked sourceRoot built (preserve symlinks: %s)',
      (preserveSymlinks) => {
        fs.createFilesSync({ 'packages/linked/actual/plugin.js': '' });
        symlinkSync('actual', join(fs.tempDir, 'packages/linked/src'), 'dir');
        const linkedProjects = {
          linked: {
            name: 'linked',
            root: 'packages/linked',
            sourceRoot: 'packages/linked/src',
            targets: {},
          },
        };
        const script = `
          const fs = require('node:fs');
          const Module = require('node:module');
          const resolve = Module._resolveFilename;
          Module._resolveFilename = function (...args) {
            const file = resolve.apply(this, args);
            return typeof file === 'string' && file.includes(require('node:path').sep + 'node_modules' + require('node:path').sep)
              ? fs.realpathSync(file) : file;
          };
          require(${JSON.stringify(require.resolve('@swc-node/register'))});
          const { getPluginPathAndName } = require(${JSON.stringify(join(__dirname, 'resolve-plugin.ts'))});
          const result = getPluginPathAndName(
            './packages/linked/src/plugin.js',
            [${JSON.stringify(fs.tempDir)}],
            ${JSON.stringify(linkedProjects)},
            ${JSON.stringify(fs.tempDir)}
          );
          process.stdout.write(JSON.stringify(result));
        `;
        const result = JSON.parse(
          execFileSync(
            process.execPath,
            [
              ...(preserveSymlinks ? ['--preserve-symlinks'] : []),
              '-e',
              script,
            ],
            {
              encoding: 'utf8',
              env: {
                ...process.env,
                NX_WORKSPACE_ROOT_PATH: fs.tempDir,
                NX_WORKSPACE_DATA_DIRECTORY: join(fs.tempDir, '.data'),
                NX_DAEMON: 'false',
              },
            }
          )
        );
        expect(result.isSourcePlugin).toBe(false);
        expect(result.projectRoot).toBe('packages/linked');
        expect(result.pluginPath).toBe(
          join(
            fs.tempDir,
            'packages/linked',
            preserveSymlinks ? 'src/plugin.js' : 'actual/plugin.js'
          )
        );
      }
    );

    it('leaves a bare specifier linked into the workspace on the extension rule', () => {
      mkdirSync(join(fs.tempDir, 'node_modules'), { recursive: true });
      symlinkSync(
        join(fs.tempDir, 'packages/plugin/src'),
        join(fs.tempDir, 'node_modules/alias')
      );

      const result = load('alias/plugin.mjs');

      expect(result.isSourcePlugin).toBe(false);
      expect(result.projectRoot).toBeUndefined();
    });

    it('keeps a file outside every project built', () => {
      const result = load('./tools/plugin.mjs');

      expect(result.isSourcePlugin).toBe(false);
      expect(result.projectRoot).toBeUndefined();
    });

    it('leaves an absolute registration on the extension rule even with projects loaded', () => {
      const result = load(join(fs.tempDir, 'packages/plugin/src/plugin.mjs'));

      expect(result.isSourcePlugin).toBe(false);
      expect(result.projectRoot).toBeUndefined();
    });
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
