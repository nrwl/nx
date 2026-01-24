// Module-level mock container - initialized early so jest.mock factories can reference it
const mocks = {
  deriveSpecifierFromConventionalCommits: jest.fn(),
  deriveSpecifierFromVersionPlan: jest.fn(),
  resolveVersionActionsForProject: jest.fn(),
  resolveCurrentVersion: jest.fn(),
};

// Export for external access (e.g., from test-utils)
export const mockDeriveSpecifierFromConventionalCommits =
  mocks.deriveSpecifierFromConventionalCommits;
export const mockDeriveSpecifierFromVersionPlan =
  mocks.deriveSpecifierFromVersionPlan;
export const mockResolveVersionActionsForProject =
  mocks.resolveVersionActionsForProject;
export const mockResolveCurrentVersion = mocks.resolveCurrentVersion;

// Use jest.mock (hoisted) instead of jest.doMock for more reliable mocking
jest.mock('../version/derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits: (...args: any[]) =>
    mocks.deriveSpecifierFromConventionalCommits(...args),
}));

jest.mock('../version/version-actions', () => {
  const actual = jest.requireActual('../version/version-actions');
  return {
    ...actual,
    deriveSpecifierFromVersionPlan: (...args: any[]) =>
      mocks.deriveSpecifierFromVersionPlan(...args),
    resolveVersionActionsForProject: (...args: any[]) =>
      mocks.resolveVersionActionsForProject(...args),
  };
});

jest.mock('../version/project-logger', () => {
  const actual = jest.requireActual('../version/project-logger');
  return {
    ...actual,
    ProjectLogger: class ProjectLogger {
      buffer() {}
      flush() {}
    },
  };
});

jest.mock('../version/resolve-current-version', () => ({
  resolveCurrentVersion: (...args: any[]) =>
    mocks.resolveCurrentVersion(...args),
}));

import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../../generators/tree';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  mockResolveVersionActionsForProjectImplementation,
} from '../version/test-utils';
import { createReleaseGraph } from './release-graph';

process.env.NX_DAEMON = 'false';

describe('ReleaseGraph', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    mockResolveVersionActionsForProject.mockImplementation(
      mockResolveVersionActionsForProjectImplementation
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  describe('basic graph construction', () => {
    it('should build graph for a simple fixed release group with no dependencies', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "fixed" }):
            - projectA@1.0.0 [js]
            - projectB@1.0.0 [js]
            - projectC@1.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const graph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      expect(graph.allProjectsConfiguredForNxRelease.size).toBe(3);
      expect(graph.allProjectsToProcess.size).toBe(3);
      expect(graph.getReleaseGroupForProject('projectA')?.name).toBe(
        '__default__'
      );
      expect(graph.sortedReleaseGroups).toEqual(['__default__']);
    });

    it('should build graph with dependency relationships', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent" }):
            - projectA@1.0.0 [js]
              -> depends on projectB
            - projectB@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const graph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      expect(graph.getProjectDependencies('projectA').has('projectB')).toBe(
        true
      );
      expect(graph.getProjectDependents('projectB').has('projectA')).toBe(true);
    });
  });

  describe('filtering - fixed release groups', () => {
    // TODO: Maybe this should not error as it is perhaps just a logical extension of expanding the filtered group based on dependents (which all other projects in the fixed release group implicitly _kind of_ are)
    it('should ERROR when filtering to subset of projects in a fixed group', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "fixed" }):
            - projectA@1.0.0 [js]
            - projectB@1.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion,
          {
            projects: ['projectB'], // Try to filter to only projectB in a fixed group
          }
        );

      await expect(
        createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        })
      ).rejects.toThrow(
        /Cannot filter to a subset of projects within fixed release group/
      );
    });

    // TODO: test would be redundant if we change the one above to not error
    it('should NOT error when manually filtering to ALL projects in a fixed group', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "fixed" }):
            - projectA@1.0.0 [js]
            - projectB@1.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion,
          {
            projects: ['projectA', 'projectB'],
          }
        );

      const graph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      expect(graph.allProjectsToProcess.size).toBe(2);
      expect(graph.isProjectToProcess('projectA')).toBe(true);
      expect(graph.isProjectToProcess('projectB')).toBe(true);
    });
  });

  describe('filtering - independent release groups with updateDependents', () => {
    describe('scenario: projectA depends on projectB, filter by [projectB]', () => {
      it('should include ONLY projectB when updateDependents=never (projectA should NOT be included)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectA@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'never',
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectB'],
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only projectB should be processed
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(2);
        expect(graph.allProjectsToProcess.size).toBe(1);
        expect(graph.isProjectToProcess('projectB')).toBe(true);
        expect(graph.isProjectToProcess('projectA')).toBe(false);
      });

      it('should include BOTH projectA and projectB when updateDependents=auto (same release group)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectA@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                // updateDependents defaults to 'always'
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectB'], // filtering to only projectB with updateDependents=auto
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Both projects should be processed (same release group with auto)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(2);
        expect(graph.allProjectsToProcess.size).toBe(2);
        expect(graph.isProjectToProcess('projectB')).toBe(true);
        expect(graph.isProjectToProcess('projectA')).toBe(true);
      });

      it('should include BOTH projectA and projectB when updateDependents=always', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectA@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'always', // Explicitly set to 'always'
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectB'], // filtering to only projectB with updateDependents=always
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Both projects should be processed because A depends on B and updateDependents is always
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(2);
        expect(graph.allProjectsToProcess.size).toBe(2);
        expect(graph.isProjectToProcess('projectB')).toBe(true);
        expect(graph.isProjectToProcess('projectA')).toBe(true);
      });
    });

    describe('scenario: projectA depends on projectB, filter by [projectA]', () => {
      it('should include ONLY projectA regardless of updateDependents (projectA has no dependents)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectA@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'auto',
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectA'],
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only projectA should be processed (it has no dependents)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(2);
        expect(graph.allProjectsToProcess.size).toBe(1);
        expect(graph.isProjectToProcess('projectA')).toBe(true);
        expect(graph.isProjectToProcess('projectB')).toBe(false);
      });
    });

    describe('transitive dependencies', () => {
      it('should include all transitive dependents when updateDependents=auto within same group (C -> B -> A, filter [A])', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectC@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
                -> depends on projectA
              - projectA@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'auto',
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectA'], // filtering to only projectA with updateDependents=auto
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // All three should be included (same release group with auto)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(3);
        expect(graph.allProjectsToProcess.size).toBe(3);
        expect(graph.isProjectToProcess('projectA')).toBe(true);
        expect(graph.isProjectToProcess('projectB')).toBe(true);
        expect(graph.isProjectToProcess('projectC')).toBe(true);
      });

      it('should include all transitive dependents when updateDependents=always (C -> B -> A, filter [A])', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectC@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
                -> depends on projectA
              - projectA@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'always', // Explicitly set to 'always'
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectA'], // filtering to only projectA with updateDependents=always
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // All three should be included due to transitive dependency chain
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(3);
        expect(graph.allProjectsToProcess.size).toBe(3);
        expect(graph.isProjectToProcess('projectA')).toBe(true);
        expect(graph.isProjectToProcess('projectB')).toBe(true);
        expect(graph.isProjectToProcess('projectC')).toBe(true);
      });

      it('should include ONLY filtered project when updateDependents=never (C -> B -> A, filter [A])', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            __default__ ({ "projectsRelationship": "independent" }):
              - projectC@1.0.0 [js]
                -> depends on projectB
              - projectB@2.0.0 [js]
                -> depends on projectA
              - projectA@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'never',
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['projectA'],
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only projectA should be processed
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(3);
        expect(graph.allProjectsToProcess.size).toBe(1);
        expect(graph.isProjectToProcess('projectA')).toBe(true);
        expect(graph.isProjectToProcess('projectB')).toBe(false);
        expect(graph.isProjectToProcess('projectC')).toBe(false);
      });
    });
  });

  describe('multiple release groups', () => {
    it('should handle cross-group dependencies with proper topological ordering', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          group1 ({ "projectsRelationship": "fixed" }):
            - pkg-a@1.0.0 [js]
              -> depends on pkg-c
            - pkg-b@1.0.0 [js]
          group2 ({ "projectsRelationship": "fixed" }):
            - pkg-c@2.0.0 [js]
            - pkg-d@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const graph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      // All projects should be processed
      expect(graph.allProjectsConfiguredForNxRelease.size).toBe(4);
      expect(graph.allProjectsToProcess.size).toBe(4);

      // Verify cross-group dependency
      expect(graph.getProjectDependencies('pkg-a').has('pkg-c')).toBe(true);

      // Verify group2 comes before group1 in topological sort
      const indexGroup1 = graph.sortedReleaseGroups.indexOf('group1');
      const indexGroup2 = graph.sortedReleaseGroups.indexOf('group2');
      expect(indexGroup2).toBeLessThan(indexGroup1);
    });

    describe('updateDependents across groups', () => {
      it('should NOT propagate through groups when all have updateDependents=auto (group1 -> group2 -> group3, filter group3)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
                -> depends on pkg-e
              - pkg-d@2.0.0 [js]
            group3 ({ "projectsRelationship": "independent" }):
              - pkg-e@3.0.0 [js]
              - pkg-f@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'auto', // All groups have auto
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['pkg-e'], // Filter to only pkg-e
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only pkg-e should be included (auto does NOT include dependents outside filter)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(6);
        expect(graph.allProjectsToProcess.size).toBe(1);
        expect(graph.isProjectToProcess('pkg-e')).toBe(true);
        expect(graph.isProjectToProcess('pkg-c')).toBe(false); // NOT included with auto
        expect(graph.isProjectToProcess('pkg-a')).toBe(false); // NOT included with auto
        expect(graph.isProjectToProcess('pkg-b')).toBe(false); // No dependency chain
        expect(graph.isProjectToProcess('pkg-d')).toBe(false); // No dependency chain
        expect(graph.isProjectToProcess('pkg-f')).toBe(false); // Not included in projects filter and the group is independent
      });

      it('should propagate through all groups when all have updateDependents=always (group1 -> group2 -> group3, filter group3)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
                -> depends on pkg-e
              - pkg-d@2.0.0 [js]
            group3 ({ "projectsRelationship": "independent" }):
              - pkg-e@3.0.0 [js]
              - pkg-f@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'always', // All groups have always
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['pkg-e'], // Filter to only pkg-e
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // All dependencies should be included: pkg-e, pkg-c (depends on pkg-e), pkg-a (depends on pkg-c)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(6);
        expect(graph.allProjectsToProcess.size).toBe(3);
        expect(graph.isProjectToProcess('pkg-e')).toBe(true);
        expect(graph.isProjectToProcess('pkg-c')).toBe(true); // Included via always
        expect(graph.isProjectToProcess('pkg-a')).toBe(true); // Included via always
        expect(graph.isProjectToProcess('pkg-b')).toBe(false); // No dependency chain
        expect(graph.isProjectToProcess('pkg-d')).toBe(false); // No dependency chain
        expect(graph.isProjectToProcess('pkg-f')).toBe(false); // Not included in projects filter and the group is independent
      });
    });

    describe('groups filter', () => {
      it('should filter to only specified groups', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "fixed" }):
              - pkg-a@1.0.0 [js]
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "fixed" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
              },
            },
            mockResolveCurrentVersion,
            {
              groups: ['group1'], // Filter to only group1
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only group1 projects should be processed
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(4);
        expect(graph.allProjectsToProcess.size).toBe(2);
        expect(graph.isProjectToProcess('pkg-a')).toBe(true);
        expect(graph.isProjectToProcess('pkg-b')).toBe(true);
        expect(graph.isProjectToProcess('pkg-c')).toBe(false);
        expect(graph.isProjectToProcess('pkg-d')).toBe(false);

        // Only group1 should be in sortedReleaseGroups
        expect(graph.sortedReleaseGroups.length).toBe(1);
        expect(graph.sortedReleaseGroups).toContain('group1');
      });

      it('should NOT include dependent groups when filtering by group with updateDependents=auto (group1 -> group2, filter group2)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'auto',
              },
            },
            mockResolveCurrentVersion,
            {
              groups: ['group2'], // Filter to only group2
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only group2 projects (auto does NOT include dependents outside filter)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(4);
        expect(graph.allProjectsToProcess.size).toBe(2);
        expect(graph.isProjectToProcess('pkg-c')).toBe(true);
        expect(graph.isProjectToProcess('pkg-d')).toBe(true);
        expect(graph.isProjectToProcess('pkg-a')).toBe(false); // NOT included with auto
        expect(graph.isProjectToProcess('pkg-b')).toBe(false); // No dependency
      });

      it('should include dependent groups when filtering by group with updateDependents=always (group1 -> group2, filter group2)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'always', // Explicitly set to 'always'
              },
            },
            mockResolveCurrentVersion,
            {
              groups: ['group2'], // Filter to only group2
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // group2 projects plus pkg-a from group1 (depends on pkg-c)
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(4);
        expect(graph.allProjectsToProcess.size).toBe(3);
        expect(graph.isProjectToProcess('pkg-c')).toBe(true);
        expect(graph.isProjectToProcess('pkg-d')).toBe(true);
        expect(graph.isProjectToProcess('pkg-a')).toBe(true); // Included via updateDependents=always
        expect(graph.isProjectToProcess('pkg-b')).toBe(false); // No dependency
      });

      it('should NOT include dependent groups when filtering by group with updateDependents=never (group1 -> group2, filter group2)', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'never',
              },
            },
            mockResolveCurrentVersion,
            {
              groups: ['group2'], // Filter to only group2
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only group2 projects should be processed
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(4);
        expect(graph.allProjectsToProcess.size).toBe(2);
        expect(graph.isProjectToProcess('pkg-c')).toBe(true);
        expect(graph.isProjectToProcess('pkg-d')).toBe(true);
        expect(graph.isProjectToProcess('pkg-a')).toBe(false); // Blocked by updateDependents=never
        expect(graph.isProjectToProcess('pkg-b')).toBe(false);
      });

      it('should filter to multiple groups', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "fixed" }):
              - pkg-a@1.0.0 [js]
            group2 ({ "projectsRelationship": "fixed" }):
              - pkg-b@2.0.0 [js]
            group3 ({ "projectsRelationship": "fixed" }):
              - pkg-c@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
              },
            },
            mockResolveCurrentVersion,
            {
              groups: ['group1', 'group3'], // Filter to group1 and group3, exclude group2
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only group1 and group3 projects
        expect(graph.allProjectsConfiguredForNxRelease.size).toBe(3);
        expect(graph.allProjectsToProcess.size).toBe(2);
        expect(graph.isProjectToProcess('pkg-a')).toBe(true);
        expect(graph.isProjectToProcess('pkg-b')).toBe(false);
        expect(graph.isProjectToProcess('pkg-c')).toBe(true);

        // Only group1 and group3 in sorted groups
        expect(graph.sortedReleaseGroups).toContain('group1');
        expect(graph.sortedReleaseGroups).toContain('group3');
        expect(graph.sortedReleaseGroups).not.toContain('group2');
      });
    });

    describe('complex cross-group scenarios', () => {
      it('should NOT propagate across groups when all have auto (group1[auto] -> group2[auto] -> group3[auto])', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
                -> depends on pkg-e
            group3 ({ "projectsRelationship": "independent" }):
              - pkg-e@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'auto', // All groups have auto
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['pkg-e'], // Start from group3
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Only pkg-e should be processed (auto does NOT propagate)
        expect(graph.isProjectToProcess('pkg-e')).toBe(true); // Filtered
        expect(graph.isProjectToProcess('pkg-c')).toBe(false); // NOT included with auto
        expect(graph.isProjectToProcess('pkg-a')).toBe(false); // NOT included with auto

        // Only group3 should be in the sorted list
        expect(graph.sortedReleaseGroups).toContain('group3');
        expect(graph.sortedReleaseGroups).not.toContain('group2');
        expect(graph.sortedReleaseGroups).not.toContain('group1');
      });

      it('should handle transitive dependencies across 3 groups when all have always (group1[always] -> group2[always] -> group3[always])', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
                -> depends on pkg-e
            group3 ({ "projectsRelationship": "independent" }):
              - pkg-e@3.0.0 [js]
          `,
            {
              version: {
                conventionalCommits: true,
                updateDependents: 'always', // All groups have always
              },
            },
            mockResolveCurrentVersion,
            {
              projects: ['pkg-e'], // Start from group3
            }
          );

        const graph = await createReleaseGraph({
          tree,
          projectGraph,
          nxReleaseConfig,
          filters,
          firstRelease: false,
          preid: undefined,
          verbose: false,
        });

        // Full propagation through all groups
        expect(graph.isProjectToProcess('pkg-e')).toBe(true); // Filtered
        expect(graph.isProjectToProcess('pkg-c')).toBe(true); // Included via always
        expect(graph.isProjectToProcess('pkg-a')).toBe(true); // Included via always

        // Verify all 3 groups are in the sorted list
        expect(graph.sortedReleaseGroups).toContain('group1');
        expect(graph.sortedReleaseGroups).toContain('group2');
        expect(graph.sortedReleaseGroups).toContain('group3');

        // Verify topological ordering: group3 -> group2 -> group1
        const idx1 = graph.sortedReleaseGroups.indexOf('group1');
        const idx2 = graph.sortedReleaseGroups.indexOf('group2');
        const idx3 = graph.sortedReleaseGroups.indexOf('group3');
        expect(idx3).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx1);
      });
    });
  });

  describe('filter log', () => {
    it('should generate filter log for projects filter', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent" }):
            - projectA@1.0.0 [js]
            - projectB@2.0.0 [js]
            - projectC@3.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion,
          {
            projects: ['projectA', 'projectB'],
          }
        );

      const graph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      expect(graph.filterLog).toBeDefined();
      expect(graph.filterLog?.title).toContain('projectA,projectB');
      expect(graph.filterLog?.bodyLines).toContain('- projectA');
      expect(graph.filterLog?.bodyLines).toContain('- projectB');
    });

    it('should not generate filter log when no filters applied', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "fixed" }):
            - projectA@1.0.0 [js]
            - projectB@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const graph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      expect(graph.filterLog).toBeNull();
    });
  });

  describe('validate', () => {
    it('should error when projects in release groups outside of the filtered groups do not have valid manifestsToUpdate IF they are required to be processed because of dependencies to groups included in the filtered groups', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            group1 ({ "projectsRelationship": "fixed" }):
              - pkg-a@1.0.0 [js]
                -> depends on pkg-c
              - pkg-b@1.0.0 [js]
            group2 ({ "projectsRelationship": "fixed" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.0.0 [js]
          `,
          {
            version: {
              conventionalCommits: true,
              manifestRootsToUpdate: ['{projectRoot}'],
            },
          },
          mockResolveCurrentVersion,
          {
            // Only release group2 (but group1 has a dependency on group2)
            groups: ['group2'],
          }
        );

      // Delete the package.json for pkg-c which is outside of the filtered groups. This test is asserting that this DOES throw an error.
      tree.delete('pkg-c/package.json');

      const releaseGraph = await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        firstRelease: false,
        preid: undefined,
        verbose: false,
      });

      await expect(releaseGraph.validate(tree)).rejects
        .toThrowErrorMatchingInlineSnapshot(`
        "The project "pkg-c" does not have a package.json file available in pkg-c/

        To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "pkg-c" from the current release group, or amend the "release.version.manifestRootsToUpdate" configuration to point to where the relevant manifest should be.

        It is also possible that the project is being processed because of a dependency relationship between what you are directly versioning and the project/release group, in which case you will need to amend your filters to include all relevant projects and release groups."
      `);
    });
  });
});
