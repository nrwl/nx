import type { ProjectFileMap, ProjectGraph } from '../../config/project-graph';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import type { ReleaseGroupWithName } from './config/filter-release-groups';
import { createAPI } from './release';
import type { ReleaseGraph } from './utils/release-graph';

const { releaseVersion } = vi.hoisted(() => ({
  releaseVersion: vi.fn(),
}));

vi.mock('./version', () => ({
  createAPI: () => releaseVersion,
}));

vi.mock('./publish', () => ({
  createAPI: () => vi.fn(),
}));

vi.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: vi.fn(),
}));

vi.mock('../../project-graph/file-map-utils', () => ({
  createProjectFileMapUsingProjectGraph: vi.fn(),
  createFileMapUsingProjectGraph: vi.fn(() =>
    Promise.resolve({
      fileMap: { projectFileMap: {}, nonProjectFiles: [] },
    })
  ),
}));

vi.mock('./utils/git', async () => ({
  ...(await vi.importActual('./utils/git')),
  getCommitHash: vi.fn(() => Promise.resolve('abc123')),
  gitAdd: vi.fn(),
  gitCommit: vi.fn(),
  gitTag: vi.fn(),
  gitPush: vi.fn(),
}));

const { createProjectGraphAsync } =
  await import('../../project-graph/project-graph');
const { createProjectFileMapUsingProjectGraph } =
  await import('../../project-graph/file-map-utils');
const { gitCommit, gitTag, gitPush } = await import('./utils/git');

describe('release', () => {
  let tempFs: TempFs;
  let projectGraph: ProjectGraph;
  let projectFileMap: ProjectFileMap;
  let releaseGroup: ReleaseGroupWithName;

  beforeEach(async () => {
    vi.clearAllMocks();

    tempFs = new TempFs('nx-release-command-test');
    await tempFs.createFiles({
      'package.json': JSON.stringify({
        name: 'root',
        version: '0.0.0',
        private: true,
      }),
      'packages/pkg-a/package.json': JSON.stringify({
        name: 'pkg-a',
        version: '1.0.0',
      }),
    });

    projectGraph = {
      nodes: {
        'pkg-a': {
          name: 'pkg-a',
          type: 'lib',
          data: {
            root: 'packages/pkg-a',
            tags: [],
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
      },
      dependencies: {},
    };
    projectFileMap = {
      'pkg-a': [
        {
          file: 'packages/pkg-a/package.json',
          hash: 'abc',
        },
      ],
    };

    createProjectGraphAsync.mockResolvedValue(projectGraph);
    createProjectFileMapUsingProjectGraph.mockResolvedValue(projectFileMap);

    releaseGroup = {
      name: '__default__',
      projectsRelationship: 'fixed',
      projects: ['pkg-a'],
      changelog: false,
      versionPlans: false,
      resolvedVersionPlans: false,
      releaseTag: {
        pattern: 'v{version}',
        preferDockerVersion: false,
      },
    } as unknown as ReleaseGroupWithName;

    const releaseGraph = {
      releaseGroups: [releaseGroup],
      allReleaseGroups: [releaseGroup],
      sortedReleaseGroups: ['__default__'],
      releaseGroupToFilteredProjects: new Map([
        [releaseGroup, new Set(['pkg-a'])],
      ]),
    } as unknown as ReleaseGraph;

    releaseVersion.mockResolvedValue({
      workspaceVersion: '1.0.1',
      projectsVersionData: {
        'pkg-a': {
          currentVersion: '1.0.0',
          newVersion: '1.0.1',
          dependentProjects: [],
        },
      },
      releaseGraph,
    });

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit);
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.restoreAllMocks();
  });

  async function writeNxJson(gitPush: boolean) {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        release: {
          projects: ['pkg-a'],
          git: {
            commit: true,
            tag: true,
            push: gitPush,
          },
          changelog: {
            workspaceChangelog: false,
            projectChangelogs: false,
          },
        },
      }),
    });
  }

  function runRelease(extraArgs: Record<string, unknown> = {}) {
    const release = createAPI({}, false);
    return release({
      specifier: 'patch',
      skipPublish: true,
      dryRun: false,
      ...extraArgs,
    });
  }

  it('pushes once after tagging when git.push is true and createRelease is not configured', async () => {
    await writeNxJson(true);

    await runRelease();

    expect(releaseVersion).toHaveBeenCalledTimes(1);
    expect(releaseVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        gitCommit: false,
        gitTag: false,
        gitPush: false,
      })
    );
    expect(gitCommit).toHaveBeenCalledTimes(1);
    expect(gitTag).toHaveBeenCalledTimes(1);
    expect(gitPush).toHaveBeenCalledTimes(1);
    expect(gitPush).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: false })
    );
    expect(vi.mocked(gitTag).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(gitPush).mock.invocationCallOrder[0]
    );
  });

  it('does not push when git.push is false', async () => {
    await writeNxJson(false);

    await runRelease();

    expect(releaseVersion).toHaveBeenCalledWith(
      expect.objectContaining({ gitPush: false })
    );
    expect(gitCommit).toHaveBeenCalledTimes(1);
    expect(gitTag).toHaveBeenCalledTimes(1);
    expect(gitPush).not.toHaveBeenCalled();
  });

  it('does not push when gitPush is explicitly false', async () => {
    await writeNxJson(true);

    await runRelease({ gitPush: false });

    expect(releaseVersion).toHaveBeenCalledWith(
      expect.objectContaining({ gitPush: false })
    );
    expect(gitPush).not.toHaveBeenCalled();
  });

  it('pushes once after tagging when gitPush is explicitly true', async () => {
    await writeNxJson(false);

    await runRelease({ gitPush: true, dryRun: true });

    expect(releaseVersion).toHaveBeenCalledWith(
      expect.objectContaining({ gitPush: false })
    );
    expect(gitPush).toHaveBeenCalledTimes(1);
    expect(gitPush).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    );
    expect(vi.mocked(gitTag).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(gitPush).mock.invocationCallOrder[0]
    );
  });
});
