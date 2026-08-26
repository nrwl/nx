import type { ProjectFileMap, ProjectGraph } from '../../config/project-graph';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { output } from '../../utils/output';
import { createAPI } from './changelog';
import type { ReleaseGroupWithName } from './config/filter-release-groups';
import type { ReleaseGraph } from './utils/release-graph';

jest.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: jest.fn(),
}));

jest.mock('../../project-graph/file-map-utils', () => ({
  createProjectFileMapUsingProjectGraph: jest.fn(),
  createFileMapUsingProjectGraph: jest.fn(() =>
    Promise.resolve({
      fileMap: { projectFileMap: {}, nonProjectFiles: [] },
    })
  ),
}));

jest.mock('./utils/git', () => ({
  ...jest.requireActual('./utils/git'),
  getCommitHash: jest.fn(() => Promise.resolve('abc123')),
  getGitDiff: jest.fn(() => Promise.resolve([])),
  parseCommits: jest.fn(() => []),
  gitAdd: jest.fn(),
  gitPush: jest.fn(),
  gitTag: jest.fn(),
  sanitizeProjectNameForGitTag: jest.fn((projectName) => projectName),
}));

jest.mock('./config/version-plans', () => ({
  ...jest.requireActual('./config/version-plans'),
  readRawVersionPlans: jest.fn(() => Promise.resolve([])),
  setResolvedVersionPlansOnGroups: jest.fn(),
}));

jest.mock('./changelog/version-plan-filtering', () => ({
  ...jest.requireActual('./changelog/version-plan-filtering'),
  resolveChangelogFromSHA: jest.fn(() => Promise.resolve('fromsha')),
  resolveWorkspaceChangelogFromSHA: jest.fn(() => Promise.resolve('fromsha')),
}));

const MOCK_CHANGELOG_CONTENTS = '## 1.0.0\n\nMocked changelog contents';

jest.mock('./utils/resolve-changelog-renderer', () => ({
  resolveChangelogRenderer: jest.fn(
    () =>
      class FakeChangelogRenderer {
        async render() {
          return MOCK_CHANGELOG_CONTENTS;
        }
      }
  ),
}));

jest.mock('./utils/remote-release-clients/remote-release-client', () => ({
  ...jest.requireActual('./utils/remote-release-clients/remote-release-client'),
  createRemoteReleaseClient: jest.fn(() =>
    Promise.resolve({
      remoteReleaseProviderName: 'GitHub',
      createPostGitTask: jest.fn(),
    })
  ),
}));

const {
  createProjectGraphAsync,
} = require('../../project-graph/project-graph');
const {
  createProjectFileMapUsingProjectGraph,
} = require('../../project-graph/file-map-utils');
const {
  resolveChangelogFromSHA,
} = require('./changelog/version-plan-filtering');

describe('releaseChangelog', () => {
  let tempFs: TempFs;
  let projectGraph: ProjectGraph;
  let projectFileMap: ProjectFileMap;
  let releaseGroup: ReleaseGroupWithName;
  let releaseGraph: ReleaseGraph;

  beforeEach(async () => {
    jest.clearAllMocks();

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
      resolveRepositoryTags: jest.fn(),
      filterLog: null,
    } as unknown as ReleaseGraph;

    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'logSingleLine').mockImplementation(() => {});
    jest.spyOn(output, 'note').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.restoreAllMocks();
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
