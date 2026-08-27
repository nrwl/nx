import type { ProjectFileMap, ProjectGraph } from '../../config/project-graph';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { output } from '../../utils/output';
import { createAPI } from './changelog';
import type { ReleaseGroupWithName } from './config/filter-release-groups';
import type { ReleaseGraph } from './utils/release-graph';

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
  getGitDiff: vi.fn(() => Promise.resolve([])),
  parseCommits: vi.fn(() => []),
  gitAdd: vi.fn(),
  gitPush: vi.fn(),
  gitTag: vi.fn(),
  sanitizeProjectNameForGitTag: vi.fn((projectName) => projectName),
}));

vi.mock('./config/version-plans', async () => ({
  ...(await vi.importActual('./config/version-plans')),
  readRawVersionPlans: vi.fn(() => Promise.resolve([])),
  setResolvedVersionPlansOnGroups: vi.fn(),
}));

vi.mock('./changelog/version-plan-filtering', async () => ({
  ...(await vi.importActual('./changelog/version-plan-filtering')),
  resolveChangelogFromSHA: vi.fn(() => Promise.resolve('fromsha')),
  resolveWorkspaceChangelogFromSHA: vi.fn(() => Promise.resolve('fromsha')),
}));

const MOCK_CHANGELOG_CONTENTS = '## 1.0.0\n\nMocked changelog contents';

vi.mock('./utils/resolve-changelog-renderer', () => ({
  resolveChangelogRenderer: vi.fn(
    () =>
      class FakeChangelogRenderer {
        async render() {
          return MOCK_CHANGELOG_CONTENTS;
        }
      }
  ),
}));

vi.mock('./utils/remote-release-clients/remote-release-client', async () => ({
  ...(await vi.importActual(
    './utils/remote-release-clients/remote-release-client'
  )),
  createRemoteReleaseClient: vi.fn(() =>
    Promise.resolve({
      remoteReleaseProviderName: 'GitHub',
      createPostGitTask: vi.fn(),
    })
  ),
}));

const { createProjectGraphAsync } =
  await import('../../project-graph/project-graph');
const { createProjectFileMapUsingProjectGraph } =
  await import('../../project-graph/file-map-utils');
const { resolveChangelogFromSHA } =
  await import('./changelog/version-plan-filtering');

describe('releaseChangelog', () => {
  let tempFs: TempFs;
  let projectGraph: ProjectGraph;
  let projectFileMap: ProjectFileMap;
  let releaseGroup: ReleaseGroupWithName;
  let releaseGraph: ReleaseGraph;

  beforeEach(async () => {
    vi.clearAllMocks();

    tempFs = new TempFs('nx-release-changelog-test');
    await tempFs.createFiles({
      'package.json': JSON.stringify({
        name: 'root',
        version: '0.0.0',
        private: true,
      }),
      'packages/pkg-a/package.json': JSON.stringify({
        name: 'pkg-a',
        version: '0.0.0',
      }),
    });

    projectGraph = {
      nodes: {
        'pkg-a': {
          name: 'pkg-a',
          type: 'lib',
          data: {
            root: 'packages/pkg-a',
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
        checkAllBranchesWhen: undefined,
        requireSemver: true,
        strictPreid: false,
      },
    } as unknown as ReleaseGroupWithName;

    releaseGraph = {
      releaseGroups: [releaseGroup],
      releaseGroupToFilteredProjects: new Map([
        [releaseGroup, new Set(['pkg-a'])],
      ]),
      resolveRepositoryTags: vi.fn(),
      filterLog: null,
    } as unknown as ReleaseGraph;

    vi.spyOn(output, 'warn').mockImplementation(() => {});
    vi.spyOn(output, 'log').mockImplementation(() => {});
    vi.spyOn(output, 'logSingleLine').mockImplementation(() => {});
    vi.spyOn(output, 'note').mockImplementation(() => {});
    vi.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.restoreAllMocks();
  });

  function runReleaseChangelog(
    extraArgs: Record<string, unknown> = {}
  ): ReturnType<ReturnType<typeof createAPI>> {
    // Mirrors programmatic usage of `new ReleaseClient(config, true).releaseChangelog(...)`
    const releaseChangelog = createAPI(
      {
        changelog: {
          // `file: false` and `createRelease` unset (which resolves to false) means
          // the changelog config is considered "effectively disabled"
          workspaceChangelog: {
            file: false,
          },
        },
      },
      true
    );
    return releaseChangelog({
      version: '1.0.0',
      gitCommit: false,
      gitTag: false,
      gitPush: false,
      stageChanges: false,
      releaseGraph,
      ...extraArgs,
    } as Parameters<ReturnType<typeof createAPI>>[0]);
  }

  describe('when changelogs are effectively disabled (file: false and createRelease resolving to false)', () => {
    it('should skip changelog generation and return an empty result by default', async () => {
      const result = await runReleaseChangelog();

      expect(result).toEqual({});
      expect(output.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: `Changelogs are disabled. No changelog entries will be generated`,
        })
      );
    });

    it('should generate changelogs when forceChangelogGeneration is set, making contents available in memory', async () => {
      const result = await runReleaseChangelog({
        forceChangelogGeneration: true,
      });

      expect(output.warn).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: `Changelogs are disabled. No changelog entries will be generated`,
        })
      );
      expect(result.workspaceChangelog).toBeDefined();
      expect(result.workspaceChangelog!.contents).toEqual(
        MOCK_CHANGELOG_CONTENTS
      );
      // file: false means nothing should have been written to disk
      await expect(tempFs.readFile('CHANGELOG.md')).rejects.toThrow();
    });
  });

  describe('independent project changelogs', () => {
    it('should not resolve a changelog from ref for an unversioned dependent project', async () => {
      await tempFs.createFiles({
        'packages/pkg-b/package.json': JSON.stringify({
          name: 'pkg-b',
          version: '0.0.0',
        }),
      });
      projectGraph.nodes['pkg-b'] = {
        name: 'pkg-b',
        type: 'lib',
        data: {
          root: 'packages/pkg-b',
          targets: {
            'nx-release-publish': {},
          },
        } as any,
      };
      releaseGroup.projectsRelationship = 'independent';
      releaseGroup.projects = ['pkg-a', 'pkg-b'];
      releaseGroup.changelog = {
        createRelease: false,
        entryWhenNoChanges: false,
        file: false,
      } as ReleaseGroupWithName['changelog'];

      await runReleaseChangelog({
        forceChangelogGeneration: true,
        projects: ['pkg-a'],
        version: undefined,
        versionData: {
          'pkg-a': {
            currentVersion: '0.0.0',
            newVersion: '1.0.0',
            dependentProjects: [
              {
                dependencyCollection: 'dependencies',
                rawVersionSpec: '0.0.0',
                source: 'pkg-b',
                target: 'pkg-a',
                type: 'static',
              },
            ],
          },
        },
      });

      expect(resolveChangelogFromSHA).toHaveBeenCalledTimes(1);
      expect(resolveChangelogFromSHA).toHaveBeenCalledWith(
        expect.objectContaining({
          projectRoot: 'packages/pkg-a',
          tagPatternValues: {
            projectName: 'pkg-a',
            releaseGroupName: '__default__',
          },
        })
      );
    });
  });
});
