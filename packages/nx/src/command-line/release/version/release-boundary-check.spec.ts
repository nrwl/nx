// Module-level mock container - initialized early so vi.mock factories can reference it
const mocks = {
  deriveSpecifierFromConventionalCommits: vi.fn(),
  resolveVersionActionsForProject: vi.fn(),
  resolveCurrentVersion: vi.fn(),
  getLatestGitTagForPattern: vi.fn(),
  readRawVersionPlans: vi.fn(),
};

vi.mock('./derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits: (...args: any[]) =>
    mocks.deriveSpecifierFromConventionalCommits(...args),
}));

vi.mock('./version-actions', async () => {
  const actual = await vi.importActual('./version-actions');
  return {
    ...actual,
    resolveVersionActionsForProject: (...args: any[]) =>
      mocks.resolveVersionActionsForProject(...args),
  };
});

vi.mock('./project-logger', async () => {
  const actual = await vi.importActual('./project-logger');
  return {
    ...actual,
    ProjectLogger: class ProjectLogger {
      buffer() {}
      flush() {}
    },
  };
});

vi.mock('./resolve-current-version', () => ({
  resolveCurrentVersion: (...args: any[]) =>
    mocks.resolveCurrentVersion(...args),
}));

vi.mock('../config/version-plans', async () => {
  const actual = await vi.importActual('../config/version-plans');
  return {
    ...actual,
    readRawVersionPlans: (...args: any[]) => mocks.readRawVersionPlans(...args),
  };
});

vi.mock('../utils/git', async () => {
  const actual = await vi.importActual('../utils/git');
  return {
    ...actual,
    getLatestGitTagForPattern: (...args: any[]) =>
      mocks.getLatestGitTagForPattern(...args),
  };
});

import type { NxJsonConfiguration } from '../../../config/nx-json';
import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../../generators/tree';
import { createReleaseGraph } from '../utils/release-graph';
import {
  checkReleaseBoundary,
  formatReleaseBoundaryFinding,
  ReleaseBoundaryCheckError,
} from './release-boundary-check';
import { ReleaseGroupProcessor } from './release-group-processor';
import { NOOP_VERSION_ACTIONS } from './version-actions';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  mockResolveVersionActionsForProjectImplementation,
} from './test-utils';

// A daemon connection would keep the test process alive after the run
process.env.NX_DAEMON = 'false';

describe('checkReleaseBoundary', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.resetAllMocks();
    mocks.resolveVersionActionsForProject.mockImplementation(
      mockResolveVersionActionsForProjectImplementation
    );
    mocks.getLatestGitTagForPattern.mockImplementation(
      (_pattern, { projectName }) => ({
        tag: `${projectName}@1.0.0`,
        extractedVersion: '1.0.0',
      })
    );
  });

  async function runCheck(
    graphDefinition: string,
    releaseConfig: NxJsonConfiguration['release'],
    filters: { projects?: string[]; groups?: string[] },
    bumps: Record<string, string>,
    {
      userGivenSpecifier,
      beforeCheck,
    }: {
      userGivenSpecifier?: string;
      beforeCheck?: (
        releaseGraph: Awaited<ReturnType<typeof createReleaseGraph>>
      ) => void;
    } = {}
  ) {
    mocks.deriveSpecifierFromConventionalCommits.mockImplementation(
      (_, __, ___, ____, { name }) => bumps[name] ?? 'none'
    );
    const { nxReleaseConfig, projectGraph } =
      await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        releaseConfig,
        mocks.resolveCurrentVersion,
        filters
      );
    const releaseGraph = await createReleaseGraph({
      tree,
      projectGraph,
      nxReleaseConfig,
      filters,
      firstRelease: false,
      verbose: false,
    });
    const processor = new ReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      releaseGraph,
      {
        dryRun: false,
        verbose: false,
        firstRelease: false,
        preid: '',
        userGivenSpecifier: userGivenSpecifier as any,
        filters,
      }
    );
    await processor.processGroups();
    beforeCheck?.(releaseGraph);
    return checkReleaseBoundary({
      tree,
      projectGraph,
      nxReleaseConfig,
      releaseGraph,
      versionData: processor.getVersionData(),
      preid: '',
      userGivenSpecifier,
    });
  }

  const dependentInOtherGroup = `
    groupA ({ "projectsRelationship": "independent" }):
      - pkg-a@1.0.0 [js]
        -> depends on ^pkg-c
      - pkg-c@1.0.0 [js]
    groupB ({ "projectsRelationship": "independent" }):
      - pkg-b@1.0.0 [js]
        -> depends on ^pkg-c
  `;

  it('should report a project from another group that updateDependents "always" added to the release', async () => {
    const findings = await runCheck(
      dependentInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([
      {
        type: 'added-by-dependents',
        project: 'pkg-b',
        releaseGroup: 'groupB',
        newVersion: '1.0.1',
        releasedDependencies: ['pkg-c'],
      },
    ]);
  });

  it('should report a dependent in another group whose range admits the new version when it is not released', async () => {
    const findings = await runCheck(
      dependentInOtherGroup,
      { version: { conventionalCommits: true, updateDependents: 'auto' } },
      { groups: ['groupA'] },
      { 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([
      {
        type: 'dependent-not-released',
        project: 'pkg-b',
        releaseGroup: 'groupB',
        dependency: 'pkg-c',
        dependencyNewVersion: '1.1.0',
        declaredVersion: '^1.0.0',
        dependencyCollection: 'dependencies',
        declaredVersionAdmitsNewVersion: true,
      },
    ]);
  });

  it('should report a dependent whose exact version excludes the new version when it is not released', async () => {
    const findings = await runCheck(
      `
        groupA ({ "projectsRelationship": "independent" }):
          - pkg-a@1.0.0 [js]
          - pkg-c@1.0.0 [js]
        groupB ({ "projectsRelationship": "independent" }):
          - pkg-b@1.0.0 [js]
            -> depends on pkg-c
      `,
      { version: { conventionalCommits: true, updateDependents: 'never' } },
      { groups: ['groupA'] },
      { 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependent-not-released',
        project: 'pkg-b',
        declaredVersion: '1.0.0',
        declaredVersionAdmitsNewVersion: false,
      }),
    ]);
  });

  const dependencyInOtherGroup = `
    groupA ({ "projectsRelationship": "independent" }):
      - pkg-a@1.0.0 [js]
        -> depends on ^pkg-c
    groupC ({ "projectsRelationship": "independent" }):
      - pkg-c@1.0.0 [js]
  `;

  it('should report a dependency in another group with pending changes', async () => {
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor', 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([
      {
        type: 'dependency-not-released',
        project: 'pkg-c',
        releaseGroup: 'groupC',
        dependent: 'pkg-a',
        declaredVersion: '^1.0.0',
        pendingChanges: { status: 'detected', bump: 'minor' },
      },
    ]);
  });

  it('should not report a dependency in another group without pending changes', async () => {
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor' }
    );

    expect(findings).toEqual([]);
  });

  it('should not derive changes again for a dependency the processor already evaluated', async () => {
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA', 'groupC'] },
      { 'pkg-a': 'minor' }
    );

    expect(findings).toEqual([]);
    const derivedProjects =
      mocks.deriveSpecifierFromConventionalCommits.mock.calls.map(
        (args) => args[4].name
      );
    expect(derivedProjects.filter((p) => p === 'pkg-c')).toHaveLength(1);
  });

  it('should report a dependency as unknown when no git tag matches its release tag pattern', async () => {
    mocks.getLatestGitTagForPattern.mockReturnValue(null);
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor', 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependency-not-released',
        project: 'pkg-c',
        pendingChanges: {
          status: 'unknown',
          reason: 'no git tag matches "{projectName}@{version}"',
        },
      }),
    ]);
  });

  it('should use pending version plans of a dependency in another group', async () => {
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor' },
      {
        beforeCheck: (releaseGraph) => {
          releaseGraph.finalConfigsByProject.get('pkg-c').specifierSource =
            'version-plans';
          const groupC = releaseGraph.allReleaseGroups.find(
            (g) => g.name === 'groupC'
          );
          groupC.versionPlans = true;
          groupC.resolvedVersionPlans = [
            {
              absolutePath: '/plan-1.md',
              relativePath: '.nx/version-plans/plan-1.md',
              fileName: 'plan-1.md',
              createdOnMs: 0,
              message: 'patch c',
              commit: null,
              projectVersionBumps: { 'pkg-c': 'patch' },
            },
            {
              absolutePath: '/plan-2.md',
              relativePath: '.nx/version-plans/plan-2.md',
              fileName: 'plan-2.md',
              createdOnMs: 0,
              message: 'minor c',
              commit: null,
              projectVersionBumps: { 'pkg-c': 'minor' },
            },
          ];
        },
      }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependency-not-released',
        project: 'pkg-c',
        pendingChanges: { status: 'detected', bump: 'minor' },
      }),
    ]);
  });

  it('should treat a version plans dependency as unchanged when no version plan applies to it, without resolving its current version', async () => {
    mocks.getLatestGitTagForPattern.mockReturnValue(null);
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor' },
      {
        beforeCheck: (releaseGraph) => {
          releaseGraph.finalConfigsByProject.get('pkg-c').specifierSource =
            'version-plans';
          const groupC = releaseGraph.allReleaseGroups.find(
            (g) => g.name === 'groupC'
          );
          groupC.versionPlans = true;
          groupC.resolvedVersionPlans = [
            {
              absolutePath: '/plan.md',
              relativePath: '.nx/version-plans/plan.md',
              fileName: 'plan.md',
              createdOnMs: 0,
              message: 'another project',
              commit: null,
              projectVersionBumps: { 'pkg-other': 'major' },
            },
          ];
        },
      }
    );

    expect(findings).toEqual([]);
  });

  it('should report a dependency as unknown, without prompting, when its release group uses the prompt specifier source', async () => {
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor' },
      {
        beforeCheck: (releaseGraph) => {
          releaseGraph.finalConfigsByProject.get('pkg-c').specifierSource =
            'prompt';
        },
      }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependency-not-released',
        project: 'pkg-c',
        pendingChanges: {
          status: 'unknown',
          reason: 'its release group uses the "prompt" specifier source',
        },
      }),
    ]);
  });

  it('should report an unselected dependency in the same group under a projects filter', async () => {
    const findings = await runCheck(
      `
        groupA ({ "projectsRelationship": "independent" }):
          - pkg-a@1.0.0 [js]
            -> depends on ^pkg-c
          - pkg-c@1.0.0 [js]
      `,
      { version: { conventionalCommits: true } },
      { projects: ['pkg-a'] },
      { 'pkg-a': 'patch', 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependency-not-released',
        project: 'pkg-c',
        releaseGroup: 'groupA',
        dependent: 'pkg-a',
        pendingChanges: { status: 'detected', bump: 'minor' },
      }),
    ]);
  });

  it('should ignore projects without real version actions', async () => {
    const findings = await runCheck(
      dependentInOtherGroup,
      { version: { conventionalCommits: true, updateDependents: 'auto' } },
      { groups: ['groupA'] },
      { 'pkg-c': 'minor' },
      {
        beforeCheck: (releaseGraph) => {
          const versionActions =
            releaseGraph.projectsToVersionActions.get('pkg-c');
          releaseGraph.projectsToVersionActions.set(
            'pkg-c',
            new NOOP_VERSION_ACTIONS(
              versionActions.releaseGroup,
              versionActions.projectGraphNode,
              versionActions.finalConfigForProject
            )
          );
        },
      }
    );

    expect(findings).toEqual([]);
  });

  it('should not judge declared versions of projects whose manifests are not package.json', async () => {
    const findings = await runCheck(
      dependentInOtherGroup,
      { version: { conventionalCommits: true, updateDependents: 'auto' } },
      { groups: ['groupA'] },
      { 'pkg-c': 'minor' },
      {
        beforeCheck: (releaseGraph) => {
          releaseGraph.projectsToVersionActions.get(
            'pkg-b'
          ).validManifestFilenames = ['Cargo.toml', 'package.json'];
        },
      }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependent-not-released',
        project: 'pkg-b',
        declaredVersion: '^1.0.0',
        declaredVersionAdmitsNewVersion: null,
      }),
    ]);
  });

  it('should leave the declared version unknown when reading it throws synchronously', async () => {
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      { 'pkg-a': 'minor', 'pkg-c': 'minor' },
      {
        beforeCheck: (releaseGraph) => {
          releaseGraph.projectsToVersionActions.get(
            'pkg-a'
          ).readCurrentVersionOfDependency = () => {
            throw new Error('unsupported');
          };
        },
      }
    );

    expect(findings).toEqual([
      expect.objectContaining({
        type: 'dependency-not-released',
        project: 'pkg-c',
        declaredVersion: null,
      }),
    ]);
  });

  it('should treat a version plans dependency as unchanged when a specifier is given and no version plan files exist', async () => {
    mocks.readRawVersionPlans.mockResolvedValue([]);
    const findings = await runCheck(
      dependencyInOtherGroup,
      { version: { conventionalCommits: true } },
      { groups: ['groupA'] },
      {},
      {
        userGivenSpecifier: 'minor',
        beforeCheck: (releaseGraph) => {
          releaseGraph.finalConfigsByProject.get('pkg-c').specifierSource =
            'version-plans';
          releaseGraph.allReleaseGroups.find(
            (g) => g.name === 'groupC'
          ).versionPlans = true;
        },
      }
    );

    expect(findings).toEqual([]);
  });

  it('should read releaseBoundaryCheck from the root version config without passing it on to release groups', async () => {
    const { nxReleaseConfig } = await createNxReleaseConfigAndPopulateWorkspace(
      tree,
      dependentInOtherGroup,
      { version: { conventionalCommits: true, releaseBoundaryCheck: 'warn' } },
      mocks.resolveCurrentVersion
    );

    expect(nxReleaseConfig.version.releaseBoundaryCheck).toEqual('warn');
    expect(
      nxReleaseConfig.groups.groupA.version as Record<string, unknown>
    ).not.toHaveProperty('releaseBoundaryCheck');
  });

  it('should not report anything when no filter is applied and every change is released', async () => {
    const findings = await runCheck(
      dependentInOtherGroup,
      { version: { conventionalCommits: true } },
      {},
      { 'pkg-c': 'minor' }
    );

    expect(findings).toEqual([]);
  });

  it('should format each type of finding', async () => {
    const findings = [
      ...(await runCheck(
        dependentInOtherGroup,
        { version: { conventionalCommits: true } },
        { groups: ['groupA'] },
        { 'pkg-c': 'minor' }
      )),
      ...(await runCheck(
        dependentInOtherGroup,
        { version: { conventionalCommits: true, updateDependents: 'auto' } },
        { groups: ['groupA'] },
        { 'pkg-c': 'minor' }
      )),
      ...(await runCheck(
        dependencyInOtherGroup,
        { version: { conventionalCommits: true } },
        { groups: ['groupA'] },
        { 'pkg-a': 'minor', 'pkg-c': 'minor' }
      )),
    ];

    expect(new ReleaseBoundaryCheckError(findings).message)
      .toMatchInlineSnapshot(`
        "The release boundary check found 3 issue(s):
        - "pkg-b" (release group "groupB") was not selected, but is being released as 1.0.1 because it depends on "pkg-c" and "updateDependents" added it.
        - "pkg-b" (release group "groupB") is not being released, but depends on "pkg-c", which is being released as 1.1.0. It declares "^1.0.0" in dependencies, which admits the new version without "pkg-b" being released again.
        - "pkg-a" is being released and depends on "pkg-c" (release group "groupC"), which is not being released but has pending changes (a "minor" bump). It declares "^1.0.0"."
      `);
  });
});
