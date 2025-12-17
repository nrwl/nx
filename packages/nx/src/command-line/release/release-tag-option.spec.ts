import { createAPI } from './release';
import type { ReleaseOptions } from './command-object';
import type { NxReleaseConfig } from './config/config';
import type { ReleaseGraph } from './utils/release-graph';
import type { VersionData } from './utils/shared';

const releaseVersionHandler = jest.fn();
const releaseChangelogHandler = jest.fn();
const releasePublishHandler = jest.fn();
const mockCreateProjectGraphAsync = jest.fn();
const mockCreateProjectFileMapUsingProjectGraph = jest.fn();
const mockCreateNxReleaseConfig = jest.fn();
const mockReadRawVersionPlans = jest.fn();
const mockSetResolvedVersionPlansOnGroups = jest.fn();
const mockValidateResolvedVersionPlansAgainstFilter = jest.fn();

jest.mock('./version', () => ({
  createAPI: jest.fn(() => releaseVersionHandler),
}));

jest.mock('./changelog', () => ({
  createAPI: jest.fn(() => releaseChangelogHandler),
}));

jest.mock('./publish', () => ({
  createAPI: jest.fn(() => releasePublishHandler),
}));

jest.mock('../../project-graph/project-graph', () => {
  const actual = jest.requireActual('../../project-graph/project-graph');
  return {
    ...actual,
    createProjectGraphAsync: mockCreateProjectGraphAsync,
  };
});

jest.mock('../../project-graph/file-map-utils', () => {
  const actual = jest.requireActual('../../project-graph/file-map-utils');
  return {
    ...actual,
    createProjectFileMapUsingProjectGraph:
      mockCreateProjectFileMapUsingProjectGraph,
  };
});

jest.mock('./config/config', () => {
  const actual = jest.requireActual('./config/config');
  return {
    ...actual,
    createNxReleaseConfig: mockCreateNxReleaseConfig,
    handleNxReleaseConfigError: jest.fn(),
  };
});

jest.mock('./config/version-plans', () => {
  const actual = jest.requireActual('./config/version-plans');
  return {
    ...actual,
    readRawVersionPlans: mockReadRawVersionPlans,
    setResolvedVersionPlansOnGroups: mockSetResolvedVersionPlansOnGroups,
  };
});

jest.mock('./utils/version-plan-utils', () => {
  const actual = jest.requireActual('./utils/version-plan-utils');
  return {
    ...actual,
    validateResolvedVersionPlansAgainstFilter:
      mockValidateResolvedVersionPlansAgainstFilter,
  };
});

jest.mock('./utils/git', () => {
  const actual = jest.requireActual('./utils/git');
  return {
    ...actual,
    gitAdd: jest.fn(),
    gitCommit: jest.fn(),
    gitTag: jest.fn(),
    gitPush: jest.fn(),
    getCommitHash: jest.fn(),
  };
});

jest.mock('./utils/remote-release-clients/remote-release-client', () => ({
  createRemoteReleaseClient: jest.fn(),
}));

describe('nx release --tag option', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateProjectGraphAsync.mockResolvedValue({
      nodes: {
        'proj-a': {
          name: 'proj-a',
          type: 'lib',
          data: {
            root: 'proj-a',
          },
        },
      },
    });
    mockCreateProjectFileMapUsingProjectGraph.mockResolvedValue({});
    mockReadRawVersionPlans.mockResolvedValue([]);
    mockSetResolvedVersionPlansOnGroups.mockResolvedValue(undefined);
    mockValidateResolvedVersionPlansAgainstFilter.mockReturnValue(undefined);
  });

  it('forwards the provided tag to the publish handler', async () => {
    const releaseGroup = {
      name: 'group-a',
      projectsRelationship: 'fixed',
      projects: ['proj-a'],
      changelog: false,
      releaseTag: { pattern: 'v{version}' },
    };
    const releaseGraph = {
      releaseGroups: [releaseGroup],
      releaseGroupToFilteredProjects: new Map([[releaseGroup, new Set(['proj-a'])]]),
      sortedReleaseGroups: ['group-a'],
    } as unknown as ReleaseGraph;
    const versionData = {
      'proj-a': {
        currentVersion: '0.0.1',
        newVersion: '1.0.0',
        dependentProjects: [],
      },
    } satisfies VersionData;

    releaseVersionHandler.mockResolvedValue({
      workspaceVersion: '1.0.0',
      projectsVersionData: versionData,
      releaseGraph,
    });
    releaseChangelogHandler.mockResolvedValue({
      workspaceChangelog: null,
      projectChangelogs: {},
    });
    releasePublishHandler.mockResolvedValue({
      'proj-a': { code: 0 },
    });

    const nxReleaseConfig = {
      git: {
        commit: false,
        stageChanges: false,
        tag: false,
        push: false,
        pushArgs: undefined,
        tagArgs: undefined,
        tagMessage: '',
        commitArgs: undefined,
      },
      changelog: {
        workspaceChangelog: false,
        projectChangelogs: false,
      },
    } as unknown as NxReleaseConfig;
    mockCreateNxReleaseConfig.mockResolvedValue({
      error: null,
      nxReleaseConfig,
    });

    const release = createAPI(
      {
        git: {
          commit: false,
          stageChanges: false,
          tag: false,
          push: false,
        },
        changelog: {
          workspaceChangelog: false,
          projectChangelogs: false,
        },
      } as any,
      true
    );

    const releaseArgs = {
      dryRun: false,
      yes: true,
      skipPublish: false,
      tag: 'next',
    } as ReleaseOptions & { tag: string };

    const result = await release(releaseArgs);

    expect(result).toEqual({
      workspaceVersion: '1.0.0',
      projectsVersionData: versionData,
      releaseGraph,
    });
    expect(releasePublishHandler).toHaveBeenCalledTimes(1);
    expect(releasePublishHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'next',
        versionData,
      })
    );
  });
});
