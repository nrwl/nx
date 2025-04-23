import * as enquirer from 'enquirer';
import { NxReleaseVersionConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../../generators/tree';
import {
  readJson,
  updateJson,
  writeJson,
} from '../../../generators/utils/json';
import { output } from '../../../utils/output';
import { NxReleaseConfig } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { VersionData } from '../utils/shared';
import { ReleaseGroupProcessor } from './release-group-processor';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  mockResolveVersionActionsForProjectImplementation,
} from './test-utils';
import { SemverBumpType } from './version-actions';

const originalExit = process.exit;
let stubProcessExit = false;

const processExitSpy = jest
  .spyOn(process, 'exit')
  .mockImplementation((...args) => {
    if (stubProcessExit) {
      return undefined as never;
    }
    return originalExit(...args);
  });

const mockDetectPackageManager = jest.fn();
jest.doMock('nx/src/devkit-exports', () => {
  const devkit = jest.requireActual('nx/src/devkit-exports');
  return {
    ...devkit,
    detectPackageManager: mockDetectPackageManager,
  };
});

jest.mock('enquirer');

let mockDeriveSpecifierFromConventionalCommits = jest.fn();
let mockDeriveSpecifierFromVersionPlan = jest.fn();
let mockResolveVersionActionsForProject = jest.fn();

jest.doMock('./derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits:
    mockDeriveSpecifierFromConventionalCommits,
}));

jest.doMock('./version-actions', () => ({
  ...jest.requireActual('./version-actions'),
  deriveSpecifierFromVersionPlan: mockDeriveSpecifierFromVersionPlan,
  resolveVersionActionsForProject: mockResolveVersionActionsForProject,
}));

jest.mock('./project-logger', () => ({
  ...jest.requireActual('./project-logger'),
  // Don't slow down or add noise to unit tests output unnecessarily
  ProjectLogger: class ProjectLogger {
    buffer() {}
    flush() {}
  },
}));

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

type ReleaseVersionGeneratorResult = {
  data: VersionData;
  callback: (
    tree: Tree,
    opts: {
      dryRun?: boolean;
      verbose?: boolean;
      versionActionsOptions?: Record<string, unknown>;
    }
  ) => Promise<
    | string[]
    | {
        changedFiles: string[];
        deletedFiles: string[];
      }
  >;
};

/**
 * Wrapper around the new logic to allow it to provide the same interface as the old logic for the JS version generator
 * so that we can assert that the new logic is behaving as before where expected.
 */
async function releaseVersionGeneratorForTest(
  tree: Tree,
  {
    nxReleaseConfig,
    projectGraph,
    releaseGroups,
    releaseGroupToFilteredProjects,
    userGivenSpecifier,
    filters,
    preid,
  }: {
    nxReleaseConfig: NxReleaseConfig;
    projectGraph: ProjectGraph;
    releaseGroups: ReleaseGroupWithName[];
    releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>;
    userGivenSpecifier: SemverBumpType | undefined;
    filters?: {
      projects?: string[];
      groups?: string[];
    };
    preid?: string;
  }
): Promise<ReleaseVersionGeneratorResult> {
  const processor = new ReleaseGroupProcessor(
    tree,
    projectGraph,
    nxReleaseConfig,
    releaseGroups,
    releaseGroupToFilteredProjects,
    {
      dryRun: false,
      verbose: false,
      firstRelease: false,
      preid,
      userGivenSpecifier,
      filters,
    }
  );

  try {
    await processor.init();
    await processor.processGroups();

    return {
      callback: async () => {
        /**
         * Pass in the root level release.version.versionActionsOptions (release group and project level options are not respected here
         * because this takes place after all projects have been versioned)
         */
        return processor.afterAllProjectsVersioned(
          (nxReleaseConfig.version as NxReleaseVersionConfiguration)
            .versionActionsOptions
        );
      },
      data: processor.getVersionData(),
    };
  } catch (e: any) {
    // Flush any pending logs before printing the error to make troubleshooting easier
    processor.flushAllProjectLoggers();

    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      output.error({
        title: e.message,
      });
      // Dump the full stack trace in verbose mode
      console.error(e);
    } else {
      output.error({
        title: e.message,
      });
    }
    process.exit(1);
  }
}

describe('releaseVersionGenerator (ported tests)', () => {
  let tree: Tree;

  beforeEach(() => {
    // @ts-expect-error read-only property
    process.exit = processExitSpy;

    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'nx.json', (json) => {
      json.release = {};
      return json;
    });

    mockResolveVersionActionsForProject.mockImplementation(
      mockResolveVersionActionsForProjectImplementation
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    stubProcessExit = false;
  });
  afterAll(() => {
    process.exit = originalExit;
  });

  it('should return a versionData object', async () => {
    const {
      nxReleaseConfig,
      projectGraph,
      releaseGroups,
      releaseGroupToFilteredProjects,
      filters,
    } = await createNxReleaseConfigAndPopulateWorkspace(
      tree,
      `
          __default__ ({ "projectsRelationship": "fixed" }):
            - my-lib@0.0.1 [js]
            - project-with-dependency-on-my-pkg@0.0.1 [js]
              -> depends on my-lib
            - project-with-devDependency-on-my-pkg@0.0.1 [js]
              -> depends on my-lib {devDependencies}
        `,
      {
        version: {
          specifierSource: 'prompt',
        },
      }
    );

    expect(
      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'major',
        releaseGroups,
        releaseGroupToFilteredProjects,
      })
    ).toMatchInlineSnapshot(`
      {
        "callback": [Function],
        "data": {
          "my-lib": {
            "currentVersion": "0.0.1",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "0.0.1",
                "source": "project-with-dependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
              {
                "dependencyCollection": "devDependencies",
                "rawVersionSpec": "0.0.1",
                "source": "project-with-devDependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
            ],
            "newVersion": "1.0.0",
          },
          "project-with-dependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "1.0.0",
          },
          "project-with-devDependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "1.0.0",
          },
        },
      }
    `);
  });

  describe('not all given projects have package.json files', () => {
    it(`should exit with code one and print guidance when not all of the given projects are appropriate for JS versioning`, async () => {
      stubProcessExit = true;

      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "fixed" }):
              - my-lib@0.0.1 [js]
              - project-with-dependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib
              - project-with-devDependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib {devDependencies}
          `,
        {
          version: {
            specifierSource: 'prompt',
          },
        }
      );

      tree.delete('my-lib/package.json');

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementation(() => {});

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: 'major',
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: expect.stringContaining(
          'The project "my-lib" does not have a package.json file available in ./my-lib'
        ),
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
  });

  describe('package with mixed "prod" and "dev" dependencies', () => {
    it('should update local dependencies only where it needs to', async () => {
      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "fixed" }):
              - my-app@0.0.1 [js]
                -> depends on my-lib-1
                -> depends on my-lib-2 {devDependencies}
              - my-lib-1@0.0.1 [js]
              - my-lib-2@0.0.1 [js]
          `,
        {
          version: {
            specifierSource: 'prompt',
          },
        }
      );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
        projectGraph,
        userGivenSpecifier: 'major',
      });

      expect(readJson(tree, 'my-app/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib-1": "1.0.0",
          },
          "devDependencies": {
            "my-lib-2": "1.0.0",
          },
          "name": "my-app",
          "version": "1.0.0",
        }
      `);
    });
  });

  describe('fixed release group', () => {
    it(`should work with semver keywords and exact semver versions`, async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "fixed" }):
              - my-lib@0.0.1 [js]
              - project-with-dependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib
              - project-with-devDependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib {devDependencies}
          `,
        {
          version: {
            specifierSource: 'prompt',
          },
        }
      );

      expect(readJson(tree, 'my-lib/package.json').version).toEqual('0.0.1');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'major',
        releaseGroups,
        releaseGroupToFilteredProjects,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.0.0');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'minor',
        releaseGroups,
        releaseGroupToFilteredProjects,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.1.0');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch',
        releaseGroups,
        releaseGroupToFilteredProjects,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.1.1');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: '1.2.3' as SemverBumpType,
        releaseGroups,
        releaseGroupToFilteredProjects,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.2.3');
    });

    it(`should apply the updated version to the projects, including updating dependents`, async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "fixed" }):
              - my-lib@0.0.1 [js]
              - project-with-dependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib
              - project-with-devDependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib {devDependencies}
          `,
        {
          version: {
            specifierSource: 'prompt',
          },
        }
      );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'major',
        releaseGroups,
        releaseGroupToFilteredProjects,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "1.0.0",
        }
      `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "1.0.0",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "1.0.0",
        }
      `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "devDependencies": {
            "my-lib": "1.0.0",
          },
          "name": "project-with-devDependency-on-my-pkg",
          "version": "1.0.0",
        }
      `);
    });
  });

  describe('independent release group', () => {
    describe('specifierSource: prompt', () => {
      it(`should appropriately prompt for each project independently and apply the version updates across all manifest files`, async () => {
        // @ts-ignore
        enquirer.prompt = jest
          .fn()
          // First project will be minor
          .mockReturnValueOnce(Promise.resolve({ specifier: 'minor' }))
          // Next project will be patch
          .mockReturnValueOnce(Promise.resolve({ specifier: 'patch' }))
          // Final project will be custom explicit version
          .mockReturnValueOnce(Promise.resolve({ specifier: 'custom' }))
          .mockReturnValueOnce(Promise.resolve({ specifier: '1.2.3' }));

        const {
          nxReleaseConfig,
          projectGraph,
          releaseGroups,
          releaseGroupToFilteredProjects,
          filters,
        } = await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
              __default__ ({ "projectsRelationship": "independent" }):
                - my-lib@0.0.1 [js]
                - project-with-dependency-on-my-pkg@0.0.1 [js]
                  -> depends on my-lib
                - project-with-devDependency-on-my-pkg@0.0.1 [js]
                  -> depends on my-lib {devDependencies}
            `,
          {
            version: {
              specifierSource: 'prompt',
            },
          }
        );

        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: undefined,
          releaseGroups,
          releaseGroupToFilteredProjects,
        });

        expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "0.1.0",
          }
        `);

        expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "0.1.0",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "0.0.2",
          }
        `);
        expect(
          readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
        ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "0.1.0",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "1.2.3",
          }
        `);
      });
      it(`should respect an explicit user CLI specifier for all, even when projects are independent, and apply the version updates across all manifest files`, async () => {
        const {
          nxReleaseConfig,
          projectGraph,
          releaseGroups,
          releaseGroupToFilteredProjects,
          filters,
        } = await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
              __default__ ({ "projectsRelationship": "independent" }):
                - my-lib@0.0.1 [js]
                - project-with-dependency-on-my-pkg@0.0.1 [js]
                  -> depends on my-lib
                - project-with-devDependency-on-my-pkg@0.0.1 [js]
                  -> depends on my-lib {devDependencies}
            `,
          {
            version: {
              specifierSource: 'prompt',
            },
          }
        );

        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: '4.5.6' as SemverBumpType,
          releaseGroups,
          releaseGroupToFilteredProjects,
        });

        expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "4.5.6",
          }
        `);

        expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "4.5.6",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "4.5.6",
          }
        `);
        expect(
          readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
        ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "4.5.6",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "4.5.6",
          }
        `);
      });

      describe('updateDependentsOptions', () => {
        it(`should update dependents even when filtering to a subset of projects which do not include those dependents, by default`, async () => {
          const {
            nxReleaseConfig,
            projectGraph,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
          } = await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
                __default__ ({ "projectsRelationship": "independent" }):
                  - my-lib@0.0.1 [js]
                  - project-with-dependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib
                  - project-with-devDependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib {devDependencies}
              `,
            {
              version: {
                specifierSource: 'prompt',
                // No value for updateDependents, should default to 'auto'
              },
            },
            undefined,
            {
              // version only my-lib
              projects: ['my-lib'],
            }
          );

          expect(readJson(tree, 'my-lib/package.json').version).toEqual(
            '0.0.1'
          );
          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);

          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            projectGraph,
            filters,
            userGivenSpecifier: '9.9.9' as SemverBumpType,
            releaseGroups,
            releaseGroupToFilteredProjects,
          });

          expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "9.9.9",
            }
          `);

          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "9.9.9",
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.2",
            }
          `);
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "9.9.9",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.2",
            }
          `);
        });

        it(`should not update dependents when filtering to a subset of projects by default, if "updateDependents" is set to "never"`, async () => {
          const {
            nxReleaseConfig,
            projectGraph,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
          } = await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
                __default__ ({ "projectsRelationship": "independent" }):
                  - my-lib@0.0.1 [js]
                  - project-with-dependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib
                  - project-with-devDependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib {devDependencies}
              `,
            {
              version: {
                specifierSource: 'prompt',
                updateDependents: 'never',
              },
            },
            undefined,
            {
              projects: ['my-lib'],
            }
          );

          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            projectGraph,
            filters,
            userGivenSpecifier: '9.9.9' as SemverBumpType,
            releaseGroups,
            releaseGroupToFilteredProjects,
          });

          expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "9.9.9",
            }
          `);

          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);
        });

        it(`should update dependents even when filtering to a subset of projects which do not include those dependents, if "updateDependents" is "auto"`, async () => {
          const {
            nxReleaseConfig,
            projectGraph,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
          } = await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
                __default__ ({ "projectsRelationship": "independent" }):
                  - my-lib@0.0.1 [js]
                  - project-with-dependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib
                  - project-with-devDependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib {devDependencies}
              `,
            {
              version: {
                specifierSource: 'prompt',
                updateDependents: 'auto',
              },
            },
            undefined,
            {
              projects: ['my-lib'],
            }
          );

          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            filters,
            projectGraph,
            userGivenSpecifier: '9.9.9' as SemverBumpType,
            releaseGroups,
            releaseGroupToFilteredProjects,
          });

          expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "9.9.9",
            }
          `);

          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "9.9.9",
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.2",
            }
          `);
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "9.9.9",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.2",
            }
          `);
        });

        it('should update dependents with a prepatch when creating a pre-release version', async () => {
          const {
            nxReleaseConfig,
            projectGraph,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
          } = await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
                __default__ ({ "projectsRelationship": "independent" }):
                  - my-lib@0.0.1 [js]
                  - project-with-dependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib
                  - project-with-devDependency-on-my-pkg@0.0.1 [js]
                    -> depends on my-lib {devDependencies}
              `,
            {
              version: {
                specifierSource: 'prompt',
              },
            }
          );

          expect(readJson(tree, 'my-lib/package.json').version).toEqual(
            '0.0.1'
          );
          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
              .version
          ).toEqual('0.0.1');
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
              .version
          ).toEqual('0.0.1');

          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            filters,
            projectGraph,
            userGivenSpecifier: 'prepatch' as SemverBumpType,
            releaseGroups,
            releaseGroupToFilteredProjects,
            preid: 'alpha',
          });

          expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "0.0.2-alpha.0",
            }
          `);

          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "0.0.2-alpha.0",
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.2-alpha.0",
            }
          `);
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.2-alpha.0",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.2-alpha.0",
            }
          `);
        });
      });
    });
  });

  describe('leading v in version', () => {
    it(`should strip a leading v from the provided specifier`, async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "fixed" }):
              - my-lib@0.0.1 [js]
              - project-with-dependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib
              - project-with-devDependency-on-my-pkg@0.0.1 [js]
                -> depends on my-lib {devDependencies}
          `,
        {
          version: {
            specifierSource: 'prompt',
          },
        }
      );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'v8.8.8' as SemverBumpType,
        releaseGroups,
        releaseGroupToFilteredProjects,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "8.8.8",
        }
      `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "8.8.8",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "8.8.8",
        }
      `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "devDependencies": {
            "my-lib": "8.8.8",
          },
          "name": "project-with-devDependency-on-my-pkg",
          "version": "8.8.8",
        }
      `);
    });
  });

  describe('dependent version prefix', () => {
    const graphDefinition = `
      __default__ ({ "projectsRelationship": "fixed" }):
        - my-lib@0.0.1 [js]
        - project-with-dependency-on-my-pkg@0.0.1 [js]
          -> depends on my-lib
        - project-with-devDependency-on-my-pkg@0.0.1 [js]
          -> depends on my-lib {devDependencies}
        - another-project-with-devDependency-on-my-pkg@0.0.1 [js]
          -> depends on my-lib {devDependencies}
    `;

    function setDifferentVersionPrefixes(tree: Tree) {
      // Manually set different version prefixes
      const pkgWithDep = readJson(
        tree,
        'project-with-dependency-on-my-pkg/package.json'
      );
      pkgWithDep.dependencies['my-lib'] = '~0.0.1';
      writeJson(
        tree,
        'project-with-dependency-on-my-pkg/package.json',
        pkgWithDep
      );

      const pkgWithDevDep = readJson(
        tree,
        'project-with-devDependency-on-my-pkg/package.json'
      );
      pkgWithDevDep.devDependencies['my-lib'] = '^0.0.1';
      writeJson(
        tree,
        'project-with-devDependency-on-my-pkg/package.json',
        pkgWithDevDep
      );
    }

    it('should work with an empty prefix', async () => {
      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        {
          version: {
            specifierSource: 'prompt',
            versionPrefix: '',
          },
        }
      );

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "9.9.9",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "9.9.9",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(
          tree,
          'another-project-with-devDependency-on-my-pkg/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "9.9.9",
            },
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
    });

    it('should work with a ^ prefix', async () => {
      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        {
          version: {
            specifierSource: 'prompt',
            versionPrefix: '^',
          },
        }
      );

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "^9.9.9",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "^9.9.9",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(
          tree,
          'another-project-with-devDependency-on-my-pkg/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "^9.9.9",
            },
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
    });

    it('should work with a ~ prefix', async () => {
      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        {
          version: {
            specifierSource: 'prompt',
            versionPrefix: '~',
          },
        }
      );

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "~9.9.9",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "~9.9.9",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(
          tree,
          'another-project-with-devDependency-on-my-pkg/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "~9.9.9",
            },
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
    });

    it('should respect any existing prefix when explicitly set to "auto"', async () => {
      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        {
          version: {
            specifierSource: 'prompt',
            versionPrefix: 'auto',
          },
        }
      );

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "~9.9.9",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "^9.9.9",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(
          tree,
          'another-project-with-devDependency-on-my-pkg/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "9.9.9",
            },
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
    });

    it('should use the behavior of "auto" by default', async () => {
      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        {
          version: {
            specifierSource: 'prompt',
            // No value, should default to "auto"
            versionPrefix: undefined,
          },
        }
      );

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
      });

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "~9.9.9",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "^9.9.9",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
      expect(
        readJson(
          tree,
          'another-project-with-devDependency-on-my-pkg/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "my-lib": "9.9.9",
            },
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          }
        `);
    });

    it(`should exit with code one and print guidance for invalid prefix values`, async () => {
      stubProcessExit = true;

      const {
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        graphDefinition,
        {
          version: {
            specifierSource: 'prompt',
            versionPrefix: '$' as any,
          },
        }
      );

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        userGivenSpecifier: 'major' as SemverBumpType,
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: `Invalid value for versionPrefix: "$"

Valid values are: "auto", "", "~", "^", "="`,
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
  });

  describe('transitive updateDependents', () => {
    it('should not update transitive dependents when updateDependents is set to "never" and the transitive dependents are not in the same batch', async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
              __default__ ({ "projectsRelationship": "independent" }):
                - my-lib@0.0.1 [js]
                - project-with-dependency-on-my-lib@0.0.1 [js]
                  -> depends on my-lib
                - project-with-transitive-dependency-on-my-lib@0.0.1 [js]
                  -> depends on project-with-dependency-on-my-lib
            `,
        {
          version: {
            updateDependents: 'never',
          },
        },
        undefined,
        {
          projects: ['my-lib'],
        }
      );

      const result = await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
        releaseGroups,
        releaseGroupToFilteredProjects,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "my-lib": {
              "currentVersion": "0.0.1",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "0.0.1",
                  "source": "project-with-dependency-on-my-lib",
                  "target": "my-lib",
                  "type": "static",
                },
              ],
              "newVersion": "9.9.9",
            },
          },
        }
      `);

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-lib/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "0.0.1",
            },
            "name": "project-with-dependency-on-my-lib",
            "version": "0.0.1",
          }
        `);

      expect(
        readJson(
          tree,
          'project-with-transitive-dependency-on-my-lib/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "project-with-dependency-on-my-lib": "0.0.1",
            },
            "name": "project-with-transitive-dependency-on-my-lib",
            "version": "0.0.1",
          }
        `);
    });

    it('should always update transitive dependents when updateDependents is set to "auto"', async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
              __default__ ({ "projectsRelationship": "independent" }):
                - my-lib@0.0.1 [js]
                - project-with-dependency-on-my-lib@0.0.1 [js]
                  -> depends on ~my-lib
                - project-with-transitive-dependency-on-my-lib@0.0.1 [js]
                  -> depends on ^project-with-dependency-on-my-lib {devDependencies}
            `,
        {
          version: {
            updateDependents: 'auto',
          },
        },
        undefined,
        {
          projects: ['my-lib'],
        }
      );

      const result = await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
        releaseGroups,
        releaseGroupToFilteredProjects,
      });

      expect(result).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "rawVersionSpec": "~0.0.1",
                    "source": "project-with-dependency-on-my-lib",
                    "target": "my-lib",
                    "type": "static",
                  },
                ],
                "newVersion": "9.9.9",
              },
              "project-with-dependency-on-my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [
                  {
                    "dependencyCollection": "devDependencies",
                    "rawVersionSpec": "^0.0.1",
                    "source": "project-with-transitive-dependency-on-my-lib",
                    "target": "project-with-dependency-on-my-lib",
                    "type": "static",
                  },
                ],
                "newVersion": "0.0.2",
              },
              "project-with-transitive-dependency-on-my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [],
                "newVersion": "0.0.2",
              },
            },
          }
        `);

      expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "9.9.9",
          }
        `);

      expect(readJson(tree, 'project-with-dependency-on-my-lib/package.json'))
        .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "~9.9.9",
            },
            "name": "project-with-dependency-on-my-lib",
            "version": "0.0.2",
          }
        `);

      expect(
        readJson(
          tree,
          'project-with-transitive-dependency-on-my-lib/package.json'
        )
      ).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "project-with-dependency-on-my-lib": "^0.0.2",
            },
            "name": "project-with-transitive-dependency-on-my-lib",
            "version": "0.0.2",
          }
          `);
    });
  });

  describe('circular dependencies', () => {
    // a <-> b
    const circularGraphDefinition = `
      __default__ ({ "projectsRelationship": "independent" }):
        - package-a@1.0.0 [js]
          -> depends on package-b
        - package-b@1.0.0 [js]
          -> depends on package-a
    `;

    describe("updateDependents: 'never'", () => {
      it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
        const {
          nxReleaseConfig,
          projectGraph,
          releaseGroups,
          releaseGroupToFilteredProjects,
          filters,
        } = await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          circularGraphDefinition,
          {
            version: {
              updateDependents: 'never',
            },
          },
          undefined,
          {
            // version only package-a
            projects: ['package-a'],
          }
        );

        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "1.0.0",
          },
          "name": "package-a",
          "version": "1.0.0",
        }
      `);
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-a": "1.0.0",
          },
          "name": "package-b",
          "version": "1.0.0",
        }
      `);

        expect(
          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
          /**
           * Note that this one captures a breaking change in versioning v2.
           *
           * In the legacy versioning, the dependentProjects array would be empty when only versioning package-a
           * with updateDependents: 'never'. Now the dependentProjects array contains the dependent project even
           * though it is isn't versioned (because they are kind of separate concerns).
           */
        ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "package-a": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "1.0.0",
                  "source": "package-b",
                  "target": "package-a",
                  "type": "static",
                },
              ],
              "newVersion": "2.0.0",
            },
          },
        }
      `);

        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "1.0.0",
          },
          "name": "package-a",
          "version": "2.0.0",
        }
      `);
        // package-b is unchanged
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-a": "1.0.0",
          },
          "name": "package-b",
          "version": "1.0.0",
        }
      `);
      });

      it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
        const {
          nxReleaseConfig,
          projectGraph,
          releaseGroups,
          releaseGroupToFilteredProjects,
          filters,
        } = await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          circularGraphDefinition,
          {
            version: {
              updateDependents: 'never',
            },
          },
          undefined,
          {
            // version both packages
            projects: ['package-a', 'package-b'],
          }
        );

        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "1.0.0",
          },
          "name": "package-a",
          "version": "1.0.0",
        }
      `);
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-a": "1.0.0",
          },
          "name": "package-b",
          "version": "1.0.0",
        }
      `);

        expect(
          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
        ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "package-a": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "1.0.0",
                  "source": "package-b",
                  "target": "package-a",
                  "type": "static",
                },
              ],
              "newVersion": "2.0.0",
            },
            "package-b": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "1.0.0",
                  "source": "package-a",
                  "target": "package-b",
                  "type": "static",
                },
              ],
              "newVersion": "2.0.0",
            },
          },
        }
      `);

        // Both the version of package-a, and the dependency on package-b are updated to 2.0.0
        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "2.0.0",
          },
          "name": "package-a",
          "version": "2.0.0",
        }
      `);
        // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-a": "2.0.0",
          },
          "name": "package-b",
          "version": "2.0.0",
        }
      `);
      });
    });

    describe("updateDependents: 'auto'", () => {
      it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
        const {
          nxReleaseConfig,
          projectGraph,
          releaseGroups,
          releaseGroupToFilteredProjects,
          filters,
        } = await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          circularGraphDefinition,
          {
            version: {
              updateDependents: 'auto',
            },
          },
          undefined,
          {
            // version only package-a
            projects: ['package-a'],
          }
        );

        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "1.0.0",
          },
          "name": "package-a",
          "version": "1.0.0",
        }
      `);
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-a": "1.0.0",
          },
          "name": "package-b",
          "version": "1.0.0",
        }
      `);

        expect(
          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
        ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "package-a": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "1.0.0",
                  "source": "package-b",
                  "target": "package-a",
                  "type": "static",
                },
              ],
              "newVersion": "2.0.0",
            },
            "package-b": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "1.0.0",
                  "source": "package-a",
                  "target": "package-b",
                  "type": "static",
                },
              ],
              "newVersion": "1.0.1",
            },
          },
        }
      `);

        // The version of package-a has been updated to 2.0.0, and the dependency on package-b has been updated to 1.0.1
        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "1.0.1",
          },
          "name": "package-a",
          "version": "2.0.0",
        }
      `);
        // The version of package-b has been patched to 1.0.1, and the dependency on package-a has been updated to 2.0.0
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-a": "2.0.0",
          },
          "name": "package-b",
          "version": "1.0.1",
        }
      `);
      });

      it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
        const {
          nxReleaseConfig,
          projectGraph,
          releaseGroups,
          releaseGroupToFilteredProjects,
          filters,
        } = await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          circularGraphDefinition,
          {
            version: {
              updateDependents: 'auto',
            },
          },
          undefined,
          {
            // version both packages
            projects: ['package-a', 'package-b'],
          }
        );

        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.0",
            },
            "name": "package-a",
            "version": "1.0.0",
          }
        `);
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-a": "1.0.0",
            },
            "name": "package-b",
            "version": "1.0.0",
          }
        `);

        expect(
          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
        ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

        // Both the version of package-a, and the dependency on package-b are updated to 2.0.0
        expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "2.0.0",
            },
            "name": "package-a",
            "version": "2.0.0",
          }
        `);
        // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
        expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-a": "2.0.0",
            },
            "name": "package-b",
            "version": "2.0.0",
          }
        `);
      });
    });
  });

  describe('preserveLocalDependencyProtocols', () => {
    it('should preserve local `workspace:` references when preserveLocalDependencyProtocols is true', async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "independent" }):
              - package-a@1.0.0 [js]
                -> depends on package-b(workspace:*)
              - package-b@1.0.0 [js]
            `,
        {
          version: {
            specifierSource: 'prompt',
            preserveLocalDependencyProtocols: true,
          },
        },
        undefined,
        {
          // version only package-b
          projects: ['package-b'],
        }
      );

      expect(
        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          releaseGroups,
          releaseGroupToFilteredProjects,
          userGivenSpecifier: '2.0.0' as SemverBumpType,
        })
      ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "package-a": {
              "currentVersion": "1.0.0",
              "dependentProjects": [],
              "newVersion": "1.0.1",
            },
            "package-b": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "workspace:*",
                  "source": "package-a",
                  "target": "package-b",
                  "type": "static",
                },
              ],
              "newVersion": "2.0.0",
            },
          },
        }
      `);

      expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "workspace:*",
          },
          "name": "package-a",
          "version": "1.0.1",
        }
      `);

      expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "name": "package-b",
          "version": "2.0.0",
        }
      `);
    });

    it('should preserve local `file:` references when preserveLocalDependencyProtocols is true', async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        `
            __default__ ({ "projectsRelationship": "independent" }):
              - package-a@1.0.0 [js]
                -> depends on package-b(file:../package-b)
              - package-b@1.0.0 [js]
            `,
        {
          version: {
            specifierSource: 'prompt',
            preserveLocalDependencyProtocols: true,
          },
        },
        undefined,
        {
          // version only package-b
          projects: ['package-b'],
        }
      );

      expect(
        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          releaseGroups,
          releaseGroupToFilteredProjects,
          userGivenSpecifier: '2.0.0' as SemverBumpType,
        })
      ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "package-a": {
              "currentVersion": "1.0.0",
              "dependentProjects": [],
              "newVersion": "1.0.1",
            },
            "package-b": {
              "currentVersion": "1.0.0",
              "dependentProjects": [
                {
                  "dependencyCollection": "dependencies",
                  "rawVersionSpec": "file:../package-b",
                  "source": "package-a",
                  "target": "package-b",
                  "type": "static",
                },
              ],
              "newVersion": "2.0.0",
            },
          },
        }
      `);

      expect(readJson(tree, 'package-a/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "file:../package-b",
          },
          "name": "package-a",
          "version": "1.0.1",
        }
      `);

      expect(readJson(tree, 'package-b/package.json')).toMatchInlineSnapshot(`
        {
          "name": "package-b",
          "version": "2.0.0",
        }
      `);
    });
  });

  it('should not double patch transitive dependents that are already direct dependents', async () => {
    const {
      nxReleaseConfig,
      projectGraph,
      releaseGroups,
      releaseGroupToFilteredProjects,
      filters,
    } = await createNxReleaseConfigAndPopulateWorkspace(
      tree,
      `
        __default__ ({ "projectsRelationship": "independent" }):
          - core@1.0.0 [js:@slateui/core]
          - buttons@1.0.0 [js:@slateui/buttons]
            -> depends on core
          - forms@1.0.0 [js:@slateui/forms]
            -> depends on core
            -> depends on buttons
      `,
      {
        version: {
          specifierSource: 'prompt',
        },
      },
      undefined,
      {
        projects: ['core'],
      }
    );

    expect(readJson(tree, 'core/package.json')).toMatchInlineSnapshot(`
      {
        "name": "@slateui/core",
        "version": "1.0.0",
      }
    `);

    expect(readJson(tree, 'buttons/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@slateui/core": "1.0.0",
        },
        "name": "@slateui/buttons",
        "version": "1.0.0",
      }
    `);

    expect(readJson(tree, 'forms/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@slateui/buttons": "1.0.0",
          "@slateui/core": "1.0.0",
        },
        "name": "@slateui/forms",
        "version": "1.0.0",
      }
    `);

    expect(
      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        releaseGroups,
        releaseGroupToFilteredProjects,
        // Bump core to 2.0.0, which will cause buttons and forms to be patched to 1.0.1
        // This prevents a regression against an issue where forms would end up being patched twice to 1.0.2 in this scenario
        userGivenSpecifier: '2.0.0' as SemverBumpType,
      })
    ).toMatchInlineSnapshot(`
      {
        "callback": [Function],
        "data": {
          "buttons": {
            "currentVersion": "1.0.0",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "1.0.0",
                "source": "forms",
                "target": "buttons",
                "type": "static",
              },
            ],
            "newVersion": "1.0.1",
          },
          "core": {
            "currentVersion": "1.0.0",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "1.0.0",
                "source": "buttons",
                "target": "core",
                "type": "static",
              },
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "1.0.0",
                "source": "forms",
                "target": "core",
                "type": "static",
              },
            ],
            "newVersion": "2.0.0",
          },
          "forms": {
            "currentVersion": "1.0.0",
            "dependentProjects": [],
            "newVersion": "1.0.1",
          },
        },
      }
    `);

    expect(readJson(tree, 'core/package.json')).toMatchInlineSnapshot(`
      {
        "name": "@slateui/core",
        "version": "2.0.0",
      }
    `);

    expect(readJson(tree, 'buttons/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@slateui/core": "2.0.0",
        },
        "name": "@slateui/buttons",
        "version": "1.0.1",
      }
    `);

    expect(readJson(tree, 'forms/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@slateui/buttons": "1.0.1",
          "@slateui/core": "2.0.0",
        },
        "name": "@slateui/forms",
        "version": "1.0.1",
      }
    `);
  });

  describe('release-version-workspace-root-project', () => {
    describe('independent projects relationship', () => {
      describe('with workspace root as a project in the graph', () => {
        it('should not error when run with custom manifestRootsToUpdate containing {projectRoot}', async () => {
          // Create the additional expected manifests in dist (would have been created by some build process)
          writeJson(tree, 'dist/my-lib/package.json', {
            name: 'my-lib',
            version: '0.0.1',
          });
          writeJson(
            tree,
            'dist/project-with-dependency-on-my-pkg/package.json',
            {
              name: 'project-with-dependency-on-my-pkg',
              version: '0.0.1',
              dependencies: {
                'my-lib': '0.0.1',
              },
            }
          );
          writeJson(
            tree,
            'dist/project-with-devDependency-on-my-pkg/package.json',
            {
              name: 'project-with-devDependency-on-my-pkg',
              version: '0.0.1',
              devDependencies: {
                'my-lib': '0.0.1',
              },
            }
          );

          const {
            nxReleaseConfig,
            projectGraph,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
          } = await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
              myReleaseGroup ({ "projectsRelationship": "independent" }):
                - my-lib@0.0.1 [js]
                - root[.]@0.0.1 [js]
                - project-with-dependency-on-my-pkg@0.0.1 [js]
                  -> depends on my-lib
                - project-with-devDependency-on-my-pkg@0.0.1 [js]
                  -> depends on my-lib {devDependencies}
            `,
            {
              version: {
                manifestRootsToUpdate: ['dist/{projectRoot}'],
                currentVersionResolver: 'disk',
              },
            },
            undefined
          );

          expect(
            await releaseVersionGeneratorForTest(tree, {
              nxReleaseConfig,
              projectGraph,
              filters,
              releaseGroups,
              releaseGroupToFilteredProjects,
              userGivenSpecifier: 'patch',
            })
          ).toMatchInlineSnapshot(`
            {
              "callback": [Function],
              "data": {
                "my-lib": {
                  "currentVersion": "0.0.1",
                  "dependentProjects": [
                    {
                      "dependencyCollection": "dependencies",
                      "rawVersionSpec": "0.0.1",
                      "source": "project-with-dependency-on-my-pkg",
                      "target": "my-lib",
                      "type": "static",
                    },
                    {
                      "dependencyCollection": "devDependencies",
                      "rawVersionSpec": "0.0.1",
                      "source": "project-with-devDependency-on-my-pkg",
                      "target": "my-lib",
                      "type": "static",
                    },
                  ],
                  "newVersion": "0.0.2",
                },
                "project-with-dependency-on-my-pkg": {
                  "currentVersion": "0.0.1",
                  "dependentProjects": [],
                  "newVersion": "0.0.2",
                },
                "project-with-devDependency-on-my-pkg": {
                  "currentVersion": "0.0.1",
                  "dependentProjects": [],
                  "newVersion": "0.0.2",
                },
              },
            }
          `);
        });

        it('should not error when run with custom manifestRootsToUpdate containing {projectRoot} when one project does not match the others', async () => {
          // Create the additional expected manifests in dist (would have been created by some build process)
          writeJson(tree, 'dist/my-lib/package.json', {
            name: 'my-lib',
            version: '0.0.1',
          });
          writeJson(tree, 'dist/my-lib-2/package.json', {
            name: 'my-lib-2',
            version: '0.0.1',
          });

          const {
            nxReleaseConfig,
            projectGraph,
            releaseGroups,
            releaseGroupToFilteredProjects,
            filters,
          } = await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
              myReleaseGroup ({ "projectsRelationship": "independent" }):
                - depends-on-my-lib@0.0.1 [js]
                  -> depends on my-lib
                  -> release config overrides { "version": { "manifestRootsToUpdate": ["dist/pkgs/depends-on-my-lib"] } }
                - my-lib@0.0.1 [js]
                - root[.]@0.0.1 [js:@proj/source]
                - my-lib-2@0.0.1 [js]
            `,
            {
              version: {
                manifestRootsToUpdate: ['dist/{projectRoot}'],
                currentVersionResolver: 'disk',
              },
            },
            undefined,
            {
              // depends-on-my-lib will get its dependencies updated in package.json because my-lib is being versioned
              // this will happen regardless of if depends-on-my-lib should be versioned
              projects: ['my-lib', 'my-lib-2'],
            }
          );

          expect(
            await releaseVersionGeneratorForTest(tree, {
              nxReleaseConfig,
              projectGraph,
              filters,
              releaseGroups,
              releaseGroupToFilteredProjects,
              userGivenSpecifier: 'patch',
            })
          ).toMatchInlineSnapshot(`
            {
              "callback": [Function],
              "data": {
                "depends-on-my-lib": {
                  "currentVersion": "0.0.1",
                  "dependentProjects": [],
                  "newVersion": "0.0.2",
                },
                "my-lib": {
                  "currentVersion": "0.0.1",
                  "dependentProjects": [
                    {
                      "dependencyCollection": "dependencies",
                      "rawVersionSpec": "0.0.1",
                      "source": "depends-on-my-lib",
                      "target": "my-lib",
                      "type": "static",
                    },
                  ],
                  "newVersion": "0.0.2",
                },
                "my-lib-2": {
                  "currentVersion": "0.0.1",
                  "dependentProjects": [],
                  "newVersion": "0.0.2",
                },
              },
            }
          `);

          expect(readJson(tree, 'dist/pkgs/depends-on-my-lib/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "0.0.2",
              },
              "name": "depends-on-my-lib",
              "version": "0.0.2",
            }
          `);

          expect(readJson(tree, 'dist/my-lib/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "0.0.2",
            }
          `);

          expect(readJson(tree, 'dist/my-lib-2/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "my-lib-2",
              "version": "0.0.2",
            }
          `);

          expect(readJson(tree, 'package.json')).toMatchInlineSnapshot(`
            {
              "dependencies": {},
              "devDependencies": {},
              "name": "@proj/source",
            }
          `);
        });
      });
    });
  });
});
