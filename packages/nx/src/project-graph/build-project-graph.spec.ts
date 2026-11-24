import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { hashFile, IS_WASM, type NxWorkspaceFilesExternals } from '../native';
import {
  getNxWorkspaceFilesFromContext,
  resetWorkspaceContext,
} from '../utils/workspace-context';
import { buildExplicitDependencies } from '../plugins/js/project-graph/build-dependencies/build-dependencies';
import {
  buildProjectGraphUsingProjectFileMap,
  getFileMap,
  hydrateFileMap,
} from './build-project-graph';
import type { FileMapCache } from './nx-deps-cache';
import { LoadedNxPlugin } from './plugins/loaded-nx-plugin';

describe('hydrateFileMap', () => {
  const fileMap = {
    projectFileMap: { app: [{ file: 'app/index.ts', hash: 'h1' }] },
    nonProjectFiles: [{ file: 'package.json', hash: 'h2' }],
  };
  // Sentinel stands in for a napi External — only its identity is asserted.
  const rustReferences = {
    __sentinel: 'externals',
  } as unknown as NxWorkspaceFilesExternals;

  it('stores rustReferences from the new 2-arg form', () => {
    hydrateFileMap(fileMap, rustReferences);
    expect(getFileMap().rustReferences).toBe(rustReferences);
  });

  it('survives legacy 3-arg form from cached nx-cloud workers', () => {
    const legacyAllWorkspaceFiles = [
      { file: 'app/index.ts', hash: 'h1' },
      { file: 'package.json', hash: 'h2' },
    ];
    (hydrateFileMap as any)(fileMap, legacyAllWorkspaceFiles, rustReferences);
    expect(getFileMap().rustReferences).toBe(rustReferences);
  });

  it('exposes allWorkspaceFiles on getFileMap so legacy destructuring callers see []', () => {
    hydrateFileMap(fileMap, rustReferences);
    expect((getFileMap() as any).allWorkspaceFiles).toEqual([]);
  });
});

describe('rehash provenance from a native workspace gather', () => {
  let fs: TempFs;
  let commit: string;
  const supportsProvenance = process.platform !== 'win32' && !IS_WASM;
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: fs.tempDir, encoding: 'utf8' }).trim();

  async function gather() {
    const { projectFileMap, globalFiles, externalReferences } =
      await getNxWorkspaceFilesFromContext(fs.tempDir, {}, false);
    hydrateFileMap(
      { projectFileMap, nonProjectFiles: globalFiles },
      externalReferences
    );
    return getFileMap();
  }

  beforeEach(() => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('NX_CI_EXECUTION_ID', undefined);
    vi.stubEnv('NX_NO_CLOUD', undefined);
    vi.stubEnv('NX_CLOUD_USE_ULTRACACHE', undefined);
    vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', undefined);
    vi.stubEnv('NX_CLOUD_ULTRACACHE_REHASH', undefined);
    fs = new TempFs('nx-rehash-gather');
    fs.createFileSync('source.txt', 'committed');
    git('init', '--quiet');
    git('add', 'source.txt');
    git(
      '-c',
      'user.name=Nx',
      '-c',
      'user.email=nx@example.com',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'source'
    );
    commit = git('rev-parse', 'HEAD');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetWorkspaceContext();
    fs.cleanup();
  });

  it.each([
    { name: 'CI default', ci: 'true', capture: true },
    { name: 'ordinary local command', ci: 'false', capture: false },
    {
      name: 'explicit local opt-in',
      ci: 'false',
      setting: 'true',
      capture: true,
    },
    {
      name: 'explicit CI opt-out',
      ci: 'true',
      setting: 'false',
      capture: false,
    },
    { name: 'invalid CI setting', ci: 'true', setting: 'TRUE', capture: false },
    { name: 'empty CI setting', ci: 'true', setting: '', capture: false },
    {
      name: 'Cloud execution without provider detection',
      ci: 'false',
      executionId: 'job',
      capture: true,
    },
    {
      name: 'Cloud disabled in CI',
      ci: 'true',
      noCloud: 'true',
      capture: false,
    },
  ])('$name', async ({ ci, setting, executionId, noCloud, capture }) => {
    vi.stubEnv('CI', ci);
    vi.stubEnv('NX_CLOUD_ULTRACACHE_REHASH', setting);
    vi.stubEnv('NX_CI_EXECUTION_ID', executionId);
    vi.stubEnv('NX_NO_CLOUD', noCloud);
    const fresh = await gather();
    const expected = capture && supportsProvenance ? commit : undefined;
    expect(fresh.rehashSourceCommit).toBe(expected);
    expect(fresh.rustReferences.rehashSourceCommit).toBe(expected);
  });

  it('keeps a dirty native gather unverified when the runner later sees a clean checkout', async () => {
    fs.createFileSync('source.txt', 'dirty');
    const dirty = await gather();
    expect(dirty.rehashSourceCommit).toBeUndefined();
    git('restore', 'source.txt');
    git('diff', '--quiet', commit, '--');
    const stale = await gather();
    expect(
      stale.fileMap.nonProjectFiles.find((f) => f.file === 'source.txt').hash
    ).not.toBe(hashFile(join(fs.tempDir, 'source.txt')));
    expect(stale.rehashSourceCommit).toBeUndefined();
    expect(stale.rustReferences.rehashSourceCommit).toBeUndefined();

    resetWorkspaceContext();
    const fresh = await gather();
    if (supportsProvenance) {
      expect(fresh.rehashSourceCommit).toBe(commit);
      expect(fresh.rustReferences.rehashSourceCommit).toBe(commit);
      expect(JSON.stringify(fresh.rustReferences)).not.toContain(commit);
    }
    hydrateFileMap(fresh.fileMap, {
      ...fresh.rustReferences,
      rehashSourceCommit: commit,
    });
    expect(getFileMap().rehashSourceCommit).toBeUndefined();
    expect(getFileMap().rustReferences.rehashSourceCommit).toBeUndefined();
    hydrateFileMap(stale.fileMap, fresh.rustReferences);
    expect(getFileMap().rehashSourceCommit).toBeUndefined();
  });
});

describe('buildProjectGraphUsingProjectFileMap', () => {
  it('recomputes cached dependencies when a catalog value changes', async () => {
    const tempFs = new TempFs('build-project-graph-catalogs');
    try {
      await tempFs.createFiles({
        'nx.json': '{}',
        'package.json': JSON.stringify({ name: 'root' }),
        'pnpm-lock.yaml': '',
        'pnpm-workspace.yaml': "catalog:\n  '@org/lib-a': ^1.0.0\n",
        'libs/lib-a/package.json': JSON.stringify({
          name: '@org/lib-a',
          version: '1.0.0',
        }),
        'libs/lib-b/package.json': JSON.stringify({
          name: '@org/lib-b',
          dependencies: { '@org/lib-a': 'catalog:' },
        }),
      });
      const projectRootMap: Record<string, ProjectConfiguration> = {};
      for (const name of ['lib-a', 'lib-b']) {
        projectRootMap[`libs/${name}`] = {
          name,
          root: `libs/${name}`,
          metadata: {
            js: { packageName: `@org/${name}`, packageVersion: '1.0.0' },
          },
        };
      }
      const packageJsonDependencies = new LoadedNxPlugin(
        {
          name: 'package-json-dependencies',
          createDependencies: (_, ctx) =>
            buildExplicitDependencies({ analyzeSourceFiles: false }, ctx),
        },
        'package-json-dependencies'
      );
      const build = (fileMapCache: FileMapCache | null) =>
        buildProjectGraphUsingProjectFileMap(
          projectRootMap,
          {},
          {
            nonProjectFiles: [],
            projectFileMap: {
              'lib-a': [{ file: 'libs/lib-a/package.json', hash: 'lib-a' }],
              'lib-b': [{ file: 'libs/lib-b/package.json', hash: 'lib-b' }],
            },
          },
          {} as NxWorkspaceFilesExternals,
          fileMapCache,
          [packageJsonDependencies],
          {}
        );

      const first = await build(null);
      expect(first.projectGraph.dependencies['lib-b']).toEqual([
        { source: 'lib-b', target: 'lib-a', type: 'static' },
      ]);

      // Same size as the original, so only the file contents tell them apart
      tempFs.createFileSync(
        'pnpm-workspace.yaml',
        "catalog:\n  '@org/lib-a': ^2.0.0\n"
      );

      const second = await build(first.projectFileMapCache);
      expect(second.projectGraph.dependencies['lib-b']).toEqual([]);
    } finally {
      tempFs.cleanup();
    }
  });
});
