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
jest.mock('@nx/devkit', () => {
  const devkit = jest.requireActual('@nx/devkit');
  return {
    ...devkit,
    detectPackageManager: mockDetectPackageManager,
  };
});

import { ProjectGraph, Tree, output, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as enquirer from 'enquirer';
import { ReleaseGroupWithName } from 'nx/src/command-line/release/config/filter-release-groups';
import { releaseVersionGenerator } from './release-version';
import { createWorkspaceWithPackageDependencies } from './test-utils/create-workspace-with-package-dependencies';

jest.mock('enquirer');

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

describe('release-version', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    // @ts-expect-error read-only property
    process.exit = processExitSpy;

    tree = createTreeWithEmptyWorkspace();

    projectGraph = createWorkspaceWithPackageDependencies(tree, {
      'my-lib': {
        projectRoot: 'libs/my-lib',
        packageName: 'my-lib',
        version: '0.0.1',
        packageJsonPath: 'libs/my-lib/package.json',
        localDependencies: [],
      },
      'project-with-dependency-on-my-pkg': {
        projectRoot: 'libs/project-with-dependency-on-my-pkg',
        packageName: 'project-with-dependency-on-my-pkg',
        version: '0.0.1',
        packageJsonPath: 'libs/project-with-dependency-on-my-pkg/package.json',
        localDependencies: [
          {
            projectName: 'my-lib',
            dependencyCollection: 'dependencies',
            version: '0.0.1',
          },
        ],
      },
      'project-with-devDependency-on-my-pkg': {
        projectRoot: 'libs/project-with-devDependency-on-my-pkg',
        packageName: 'project-with-devDependency-on-my-pkg',
        version: '0.0.1',
        packageJsonPath:
          'libs/project-with-devDependency-on-my-pkg/package.json',
        localDependencies: [
          {
            projectName: 'my-lib',
            dependencyCollection: 'devDependencies',
            version: '0.0.1',
          },
        ],
      },
    });
  });
  afterEach(() => {
    jest.clearAllMocks();
    stubProcessExit = false;
  });
  afterAll(() => {
    process.exit = originalExit;
  });

  it('should return a versionData object', async () => {
    expect(
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
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
    beforeEach(() => {
      tree.delete('libs/my-lib/package.json');
    });

    it(`should exit with code one and print guidance when not all of the given projects are appropriate for JS versioning`, async () => {
      stubProcessExit = true;

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: `The project "my-lib" does not have a package.json available at libs/my-lib/package.json.

To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "my-lib" from the current release group, or amend the packageRoot configuration to point to where the package.json should be.`,
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
  });

  describe('package with mixed "prod" and "dev" dependencies', () => {
    beforeEach(() => {
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'my-app': {
          projectRoot: 'libs/my-app',
          packageName: 'my-app',
          version: '0.0.1',
          packageJsonPath: 'libs/my-app/package.json',
          localDependencies: [
            {
              projectName: 'my-lib-1',
              dependencyCollection: 'dependencies',
              version: '0.0.1',
            },
            {
              projectName: 'my-lib-2',
              dependencyCollection: 'devDependencies',
              version: '0.0.1',
            },
          ],
        },
        'my-lib-1': {
          projectRoot: 'libs/my-lib-1',
          packageName: 'my-lib-1',
          version: '0.0.1',
          packageJsonPath: 'libs/my-lib-1/package.json',
          localDependencies: [],
        },
        'my-lib-2': {
          projectRoot: 'libs/my-lib-2',
          packageName: 'my-lib-2',
          version: '0.0.1',
          packageJsonPath: 'libs/my-lib-2/package.json',
          localDependencies: [],
        },
      });
    });

    it('should update local dependencies only where it needs to', async () => {
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });

      expect(readJson(tree, 'libs/my-app/package.json')).toMatchInlineSnapshot(`
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
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '1.0.0'
      );

      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'minor',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '1.1.0'
      );

      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'patch',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '1.1.1'
      );

      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: '1.2.3', // exact version
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '1.2.3'
      );
    });

    it(`should apply the updated version to the projects, including updating dependents`, async () => {
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });

      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "1.0.0",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "1.0.0",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "1.0.0",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
      it(`should appropriately prompt for each project independently and apply the version updates across all package.json files`, async () => {
        // @ts-expect-error read-only property
        enquirer.prompt = jest
          .fn()
          // First project will be minor
          .mockReturnValueOnce(Promise.resolve({ specifier: 'minor' }))
          // Next project will be patch
          .mockReturnValueOnce(Promise.resolve({ specifier: 'patch' }))
          // Final project will be custom explicit version
          .mockReturnValueOnce(Promise.resolve({ specifier: 'custom' }))
          .mockReturnValueOnce(Promise.resolve({ specifier: '1.2.3' }));

        expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
          '0.0.1'
        );
        expect(
          readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
            .version
        ).toEqual('0.0.1');
        expect(
          readJson(
            tree,
            'libs/project-with-devDependency-on-my-pkg/package.json'
          ).version
        ).toEqual('0.0.1');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '', // no specifier override set, each individual project will be prompted
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: createReleaseGroup('independent'),
        });

        expect(readJson(tree, 'libs/my-lib/package.json'))
          .toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "0.1.0",
          }
        `);

        expect(
          readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
        ).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "0.1.0",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "0.0.2",
          }
        `);
        expect(
          readJson(
            tree,
            'libs/project-with-devDependency-on-my-pkg/package.json'
          )
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

      it(`should respect an explicit user CLI specifier for all, even when projects are independent, and apply the version updates across all package.json files`, async () => {
        expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
          '0.0.1'
        );
        expect(
          readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
            .version
        ).toEqual('0.0.1');
        expect(
          readJson(
            tree,
            'libs/project-with-devDependency-on-my-pkg/package.json'
          ).version
        ).toEqual('0.0.1');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '4.5.6', // user CLI specifier override set, no prompting should occur
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: createReleaseGroup('independent'),
        });

        expect(readJson(tree, 'libs/my-lib/package.json'))
          .toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "4.5.6",
          }
        `);

        expect(
          readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
        ).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "4.5.6",
            },
            "name": "project-with-dependency-on-my-pkg",
            "version": "4.5.6",
          }
        `);
        expect(
          readJson(
            tree,
            'libs/project-with-devDependency-on-my-pkg/package.json'
          )
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
          expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
            '0.0.1'
          );
          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);

          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            // No value for updateDependents, should default to 'auto'
          });

          expect(readJson(tree, 'libs/my-lib/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "9.9.9",
            }
          `);

          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
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
          expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
            '0.0.1'
          );
          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);

          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'never',
          });

          expect(readJson(tree, 'libs/my-lib/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "9.9.9",
            }
          `);

          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
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
          expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
            '0.0.1'
          );
          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.1",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.1",
            }
          `);

          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'auto',
          });

          expect(readJson(tree, 'libs/my-lib/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "9.9.9",
            }
          `);

          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
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

        it('should not update dependents that depend on fixed versions, if "updateDependents" is "auto"', async () => {
          // Supported package manager for workspace: protocol
          mockDetectPackageManager.mockReturnValue('pnpm');

          projectGraph = createWorkspaceWithPackageDependencies(tree, {
            'package-a': {
              projectRoot: 'packages/package-a',
              packageName: 'package-a',
              version: '3.0.0',
              packageJsonPath: 'packages/package-a/package.json',
              localDependencies: [],
            },
            'package-b': {
              projectRoot: 'packages/package-b',
              packageName: 'package-b',
              version: '4.1.0',
              packageJsonPath: 'packages/package-b/package.json',
              localDependencies: [
                {
                  projectName: 'package-a',
                  dependencyCollection: 'dependencies',
                  version: 'workspace:^',
                },
              ],
            },
            'package-c': {
              projectRoot: 'packages/package-c',
              packageName: 'package-c',
              version: '3.0.18',
              packageJsonPath: 'packages/package-c/package.json',
              localDependencies: [
                {
                  projectName: 'package-a',
                  dependencyCollection: 'dependencies',
                  version: '2.4.0',
                },
              ],
            },
            'package-d': {
              projectRoot: 'packages/package-d',
              packageName: 'package-d',
              version: '6.12.8',
              packageJsonPath: 'packages/package-d/package.json',
              localDependencies: [
                {
                  projectName: 'package-a',
                  dependencyCollection: 'dependencies',
                  version: '^3.0.0',
                },
              ],
            },
          });

          expect(readJson(tree, 'packages/package-a/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "package-a",
              "version": "3.0.0",
            }
          `);
          expect(readJson(tree, 'packages/package-b/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "package-a": "workspace:^",
              },
              "name": "package-b",
              "version": "4.1.0",
            }
          `);
          expect(readJson(tree, 'packages/package-c/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "package-a": "2.4.0",
              },
              "name": "package-c",
              "version": "3.0.18",
            }
          `);
          expect(readJson(tree, 'packages/package-d/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "package-a": "^3.0.0",
              },
              "name": "package-d",
              "version": "6.12.8",
            }
          `);

          expect(
            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['package-a']],
              projectGraph,
              specifier: 'minor',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              fallbackCurrentVersionResolver: 'disk',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
              preserveLocalDependencyProtocols: true,
            })
          ).toMatchInlineSnapshot(`
            {
              "callback": [Function],
              "data": {
                "package-a": {
                  "currentVersion": "3.0.0",
                  "dependentProjects": [
                    {
                      "dependencyCollection": "dependencies",
                      "rawVersionSpec": "workspace:^",
                      "source": "package-b",
                      "target": "package-a",
                      "type": "static",
                    },
                    {
                      "dependencyCollection": "dependencies",
                      "rawVersionSpec": "^3.0.0",
                      "source": "package-d",
                      "target": "package-a",
                      "type": "static",
                    },
                  ],
                  "newVersion": "3.1.0",
                },
                "package-b": {
                  "currentVersion": "4.1.0",
                  "dependentProjects": [],
                  "newVersion": "4.1.1",
                },
                "package-d": {
                  "currentVersion": "6.12.8",
                  "dependentProjects": [],
                  "newVersion": "6.12.9",
                },
              },
            }
          `);

          // package-a is bumped based on its own specifier of minor
          expect(readJson(tree, 'packages/package-a/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "package-a",
              "version": "3.1.0",
            }
          `);
          // package-b is bumped because its dependency on package-a uses workspace protocol
          expect(readJson(tree, 'packages/package-b/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "package-a": "workspace:^",
              },
              "name": "package-b",
              "version": "4.1.1",
            }
          `);
          // package-c is NOT bumped because its dependency on package-a is fixed
          expect(readJson(tree, 'packages/package-c/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "package-a": "2.4.0",
              },
              "name": "package-c",
              "version": "3.0.18",
            }
          `);
          // package-d is bumped because its dependency on package-a allows for minor and patch updates
          expect(readJson(tree, 'packages/package-d/package.json'))
            .toMatchInlineSnapshot(`
            {
              "dependencies": {
                "package-a": "^3.1.0",
              },
              "name": "package-d",
              "version": "6.12.9",
            }
          `);
        });

        it('should update dependents with a prepatch when creating a pre-release version', async () => {
          expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
            '0.0.1'
          );
          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            ).version
          ).toEqual('0.0.1');
          expect(
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            ).version
          ).toEqual('0.0.1');

          await releaseVersionGenerator(tree, {
            projects: Object.values(projectGraph.nodes), // version all projects
            projectGraph,
            currentVersionResolver: 'disk',
            specifier: 'prepatch',
            preid: 'alpha',
            releaseGroup: createReleaseGroup('independent'),
          });

          expect(readJson(tree, 'libs/my-lib/package.json'))
            .toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "0.0.2-alpha.0",
            }
          `);

          expect(
            readJson(
              tree,
              'libs/project-with-dependency-on-my-pkg/package.json'
            )
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
            readJson(
              tree,
              'libs/project-with-devDependency-on-my-pkg/package.json'
            )
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
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'v8.8.8',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
      });
      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "8.8.8",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "8.8.8",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "8.8.8",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
    beforeEach(() => {
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'my-lib': {
          projectRoot: 'libs/my-lib',
          packageName: 'my-lib',
          version: '0.0.1',
          packageJsonPath: 'libs/my-lib/package.json',
          localDependencies: [],
        },
        'project-with-dependency-on-my-pkg': {
          projectRoot: 'libs/project-with-dependency-on-my-pkg',
          packageName: 'project-with-dependency-on-my-pkg',
          version: '0.0.1',
          packageJsonPath:
            'libs/project-with-dependency-on-my-pkg/package.json',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dependencies',
              version: '~0.0.1', // already has ~
            },
          ],
        },
        'project-with-devDependency-on-my-pkg': {
          projectRoot: 'libs/project-with-devDependency-on-my-pkg',
          packageName: 'project-with-devDependency-on-my-pkg',
          version: '0.0.1',
          packageJsonPath:
            'libs/project-with-devDependency-on-my-pkg/package.json',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'devDependencies',
              version: '^0.0.1', // already has ^
            },
          ],
        },
        'another-project-with-devDependency-on-my-pkg': {
          projectRoot: 'libs/another-project-with-devDependency-on-my-pkg',
          packageName: 'another-project-with-devDependency-on-my-pkg',
          version: '0.0.1',
          packageJsonPath:
            'libs/another-project-with-devDependency-on-my-pkg/package.json',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'devDependencies',
              version: '0.0.1', // has no prefix
            },
          ],
        },
      });
    });
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should work with an empty prefix', async () => {
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: '9.9.9',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        versionPrefix: '',
      });
      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "9.9.9",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "9.9.9",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
          'libs/another-project-with-devDependency-on-my-pkg/package.json'
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
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: '9.9.9',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        versionPrefix: '^',
      });
      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "^9.9.9",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "9.9.9",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
          'libs/another-project-with-devDependency-on-my-pkg/package.json'
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
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: '9.9.9',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        versionPrefix: '~',
      });
      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~9.9.9",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "9.9.9",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
          'libs/another-project-with-devDependency-on-my-pkg/package.json'
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

    it('should respect any existing prefix when set to "auto"', async () => {
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: '9.9.9',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        versionPrefix: 'auto',
      });
      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~9.9.9",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "9.9.9",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
          'libs/another-project-with-devDependency-on-my-pkg/package.json'
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
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: '9.9.9',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        versionPrefix: undefined,
      });
      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~9.9.9",
          },
          "name": "project-with-dependency-on-my-pkg",
          "version": "9.9.9",
        }
      `);
      expect(
        readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
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
          'libs/another-project-with-devDependency-on-my-pkg/package.json'
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

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        versionPrefix: '$' as any,
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: `Invalid value for version.generatorOptions.versionPrefix: "$"

Valid values are: "auto", "", "~", "^", "="`,
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
  });

  describe('transitive updateDependents', () => {
    beforeEach(() => {
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'my-lib': {
          projectRoot: 'libs/my-lib',
          packageName: 'my-lib',
          version: '0.0.1',
          packageJsonPath: 'libs/my-lib/package.json',
          localDependencies: [],
        },
        'project-with-dependency-on-my-lib': {
          projectRoot: 'libs/project-with-dependency-on-my-lib',
          packageName: 'project-with-dependency-on-my-lib',
          version: '0.0.1',
          packageJsonPath:
            'libs/project-with-dependency-on-my-lib/package.json',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dependencies',
              version: '~0.0.1',
            },
          ],
        },
        'project-with-transitive-dependency-on-my-lib': {
          projectRoot: 'libs/project-with-transitive-dependency-on-my-lib',
          packageName: 'project-with-transitive-dependency-on-my-lib',
          version: '0.0.1',
          packageJsonPath:
            'libs/project-with-transitive-dependency-on-my-lib/package.json',
          localDependencies: [
            {
              // Depends on my-lib via the project-with-dependency-on-my-lib
              projectName: 'project-with-dependency-on-my-lib',
              dependencyCollection: 'devDependencies',
              version: '^0.0.1',
            },
          ],
        },
      });
    });
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should not update transitive dependents when updateDependents is set to "never" and the transitive dependents are not in the same batch', async () => {
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-lib/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~0.0.1",
          },
          "name": "project-with-dependency-on-my-lib",
          "version": "0.0.1",
        }
      `);
      expect(
        readJson(
          tree,
          'libs/project-with-transitive-dependency-on-my-lib/package.json'
        )
      ).toMatchInlineSnapshot(`
        {
          "devDependencies": {
            "project-with-dependency-on-my-lib": "^0.0.1",
          },
          "name": "project-with-transitive-dependency-on-my-lib",
          "version": "0.0.1",
        }
      `);

      // It should not include transitive dependents in the versionData because we are filtering to only my-lib and updateDependents is set to "never"
      expect(
        await releaseVersionGenerator(tree, {
          projects: [projectGraph.nodes['my-lib']], // version only my-lib
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: createReleaseGroup('independent'),
          updateDependents: 'never',
        })
      ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "my-lib": {
              "currentVersion": "0.0.1",
              "dependentProjects": [],
              "newVersion": "9.9.9",
            },
          },
        }
      `);

      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      // The version of project-with-dependency-on-my-lib is untouched because it is not in the same batch as my-lib and updateDependents is set to "never"
      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-lib/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~0.0.1",
          },
          "name": "project-with-dependency-on-my-lib",
          "version": "0.0.1",
        }
      `);

      // The version of project-with-transitive-dependency-on-my-lib is untouched because it is not in the same batch as my-lib and updateDependents is set to "never"
      expect(
        readJson(
          tree,
          'libs/project-with-transitive-dependency-on-my-lib/package.json'
        )
      ).toMatchInlineSnapshot(`
        {
          "devDependencies": {
            "project-with-dependency-on-my-lib": "^0.0.1",
          },
          "name": "project-with-transitive-dependency-on-my-lib",
          "version": "0.0.1",
        }
      `);
    });

    it('should always update transitive dependents when updateDependents is set to "auto"', async () => {
      expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
        '0.0.1'
      );
      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-lib/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~0.0.1",
          },
          "name": "project-with-dependency-on-my-lib",
          "version": "0.0.1",
        }
      `);
      expect(
        readJson(
          tree,
          'libs/project-with-transitive-dependency-on-my-lib/package.json'
        )
      ).toMatchInlineSnapshot(`
        {
          "devDependencies": {
            "project-with-dependency-on-my-lib": "^0.0.1",
          },
          "name": "project-with-transitive-dependency-on-my-lib",
          "version": "0.0.1",
        }
      `);

      // It should include the appropriate versionData for transitive dependents
      expect(
        await releaseVersionGenerator(tree, {
          projects: [projectGraph.nodes['my-lib']], // version only my-lib
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: createReleaseGroup('independent'),
          updateDependents: 'auto',
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

      expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "name": "my-lib",
          "version": "9.9.9",
        }
      `);

      // The version of project-with-dependency-on-my-lib gets bumped by a patch number and the dependencies reference is updated to the new version of my-lib
      expect(
        readJson(tree, 'libs/project-with-dependency-on-my-lib/package.json')
      ).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib": "~9.9.9",
          },
          "name": "project-with-dependency-on-my-lib",
          "version": "0.0.2",
        }
      `);

      // The version of project-with-transitive-dependency-on-my-lib gets bumped by a patch number and the devDependencies reference is updated to the new version of project-with-dependency-on-my-lib because of the transitive dependency on my-lib
      expect(
        readJson(
          tree,
          'libs/project-with-transitive-dependency-on-my-lib/package.json'
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
    beforeEach(() => {
      // package-a <-> package-b
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'package-a': {
          projectRoot: 'packages/package-a',
          packageName: 'package-a',
          version: '1.0.0',
          packageJsonPath: 'packages/package-a/package.json',
          localDependencies: [
            {
              projectName: 'package-b',
              dependencyCollection: 'dependencies',
              version: '1.0.0',
            },
          ],
        },
        'package-b': {
          projectRoot: 'packages/package-b',
          packageName: 'package-b',
          version: '1.0.0',
          packageJsonPath: 'packages/package-b/package.json',
          localDependencies: [
            {
              projectName: 'package-a',
              dependencyCollection: 'dependencies',
              version: '1.0.0',
            },
          ],
        },
      });
    });
    afterEach(() => {
      jest.clearAllMocks();
    });

    describe("updateDependents: 'never'", () => {
      it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.0",
            },
            "name": "package-a",
            "version": "1.0.0",
          }
        `);
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-a": "1.0.0",
            },
            "name": "package-b",
            "version": "1.0.0",
          }
        `);

        expect(
          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['package-a']], // version only package-a
            projectGraph,
            specifier: '2.0.0',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'never',
          })
        ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.0",
            },
            "name": "package-a",
            "version": "2.0.0",
          }
        `);
        // package-b is unchanged
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
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
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.0",
            },
            "name": "package-a",
            "version": "1.0.0",
          }
        `);
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-a": "1.0.0",
            },
            "name": "package-b",
            "version": "1.0.0",
          }
        `);

        expect(
          await releaseVersionGenerator(tree, {
            // version both packages
            projects: [
              projectGraph.nodes['package-a'],
              projectGraph.nodes['package-b'],
            ],

            projectGraph,
            specifier: '2.0.0',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'never',
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
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "2.0.0",
            },
            "name": "package-a",
            "version": "2.0.0",
          }
        `);
        // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
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
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.0",
            },
            "name": "package-a",
            "version": "1.0.0",
          }
        `);
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-a": "1.0.0",
            },
            "name": "package-b",
            "version": "1.0.0",
          }
        `);

        expect(
          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['package-a']], // version only package-a
            projectGraph,
            specifier: '2.0.0',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'auto',
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
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.1",
            },
            "name": "package-a",
            "version": "2.0.0",
          }
        `);
        // The version of package-b has been patched to 1.0.1, and the dependency on package-a has been updated to 2.0.0
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
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
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "1.0.0",
            },
            "name": "package-a",
            "version": "1.0.0",
          }
        `);
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-a": "1.0.0",
            },
            "name": "package-b",
            "version": "1.0.0",
          }
        `);

        expect(
          await releaseVersionGenerator(tree, {
            // version both packages
            projects: [
              projectGraph.nodes['package-a'],
              projectGraph.nodes['package-b'],
            ],
            projectGraph,
            specifier: '2.0.0',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'auto',
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
        expect(readJson(tree, 'packages/package-a/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "package-b": "2.0.0",
            },
            "name": "package-a",
            "version": "2.0.0",
          }
        `);
        // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
        expect(readJson(tree, 'packages/package-b/package.json'))
          .toMatchInlineSnapshot(`
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
      // Supported package manager for workspace: protocol
      mockDetectPackageManager.mockReturnValue('pnpm');

      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'package-a': {
          projectRoot: 'packages/package-a',
          packageName: 'package-a',
          version: '1.0.0',
          packageJsonPath: 'packages/package-a/package.json',
          localDependencies: [
            {
              projectName: 'package-b',
              dependencyCollection: 'dependencies',
              version: 'workspace:*',
            },
          ],
        },
        'package-b': {
          projectRoot: 'packages/package-b',
          packageName: 'package-b',
          version: '1.0.0',
          packageJsonPath: 'packages/package-b/package.json',
          localDependencies: [],
        },
      });

      expect(readJson(tree, 'packages/package-a/package.json'))
        .toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "workspace:*",
          },
          "name": "package-a",
          "version": "1.0.0",
        }
      `);
      expect(readJson(tree, 'packages/package-b/package.json'))
        .toMatchInlineSnapshot(`
        {
          "name": "package-b",
          "version": "1.0.0",
        }
      `);

      expect(
        await releaseVersionGenerator(tree, {
          projects: [projectGraph.nodes['package-b']], // version only package-b
          projectGraph,
          specifier: '2.0.0',
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: createReleaseGroup('independent'),
          updateDependents: 'auto',
          preserveLocalDependencyProtocols: true,
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

      expect(readJson(tree, 'packages/package-a/package.json'))
        .toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "workspace:*",
          },
          "name": "package-a",
          "version": "1.0.1",
        }
      `);

      expect(readJson(tree, 'packages/package-b/package.json'))
        .toMatchInlineSnapshot(`
        {
          "name": "package-b",
          "version": "2.0.0",
        }
      `);
    });

    it('should preserve local `file:` references when preserveLocalDependencyProtocols is true', async () => {
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'package-a': {
          projectRoot: 'packages/package-a',
          packageName: 'package-a',
          version: '1.0.0',
          packageJsonPath: 'packages/package-a/package.json',
          localDependencies: [
            {
              projectName: 'package-b',
              dependencyCollection: 'dependencies',
              version: 'file:../package-b',
            },
          ],
        },
        'package-b': {
          projectRoot: 'packages/package-b',
          packageName: 'package-b',
          version: '1.0.0',
          packageJsonPath: 'packages/package-b/package.json',
          localDependencies: [],
        },
      });

      expect(readJson(tree, 'packages/package-a/package.json'))
        .toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "file:../package-b",
          },
          "name": "package-a",
          "version": "1.0.0",
        }
      `);
      expect(readJson(tree, 'packages/package-b/package.json'))
        .toMatchInlineSnapshot(`
        {
          "name": "package-b",
          "version": "1.0.0",
        }
      `);

      expect(
        await releaseVersionGenerator(tree, {
          projects: [projectGraph.nodes['package-b']], // version only package-b
          projectGraph,
          specifier: '2.0.0',
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: createReleaseGroup('independent'),
          updateDependents: 'auto',
          preserveLocalDependencyProtocols: true,
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

      expect(readJson(tree, 'packages/package-a/package.json'))
        .toMatchInlineSnapshot(`
        {
          "dependencies": {
            "package-b": "file:../package-b",
          },
          "name": "package-a",
          "version": "1.0.1",
        }
      `);

      expect(readJson(tree, 'packages/package-b/package.json'))
        .toMatchInlineSnapshot(`
        {
          "name": "package-b",
          "version": "2.0.0",
        }
      `);
    });
  });

  it('should not double patch transitive dependents that are already direct dependents', async () => {
    projectGraph = createWorkspaceWithPackageDependencies(tree, {
      '@slateui/core': {
        projectRoot: 'packages/core',
        packageName: '@slateui/core',
        version: '1.0.0',
        packageJsonPath: 'packages/core/package.json',
        localDependencies: [],
      },
      // buttons depends on core
      '@slateui/buttons': {
        projectRoot: 'packages/buttons',
        packageName: '@slateui/buttons',
        version: '1.0.0',
        packageJsonPath: 'packages/buttons/package.json',
        localDependencies: [
          {
            projectName: '@slateui/core',
            dependencyCollection: 'dependencies',
            version: '1.0.0',
          },
        ],
      },
      // forms depends on both core and buttons, making it both a direct and transitive dependent of core
      '@slateui/forms': {
        projectRoot: 'packages/forms',
        packageName: '@slateui/forms',
        version: '1.0.0',
        packageJsonPath: 'packages/forms/package.json',
        localDependencies: [
          {
            projectName: '@slateui/core',
            dependencyCollection: 'dependencies',
            version: '1.0.0',
          },
          {
            projectName: '@slateui/buttons',
            dependencyCollection: 'dependencies',
            version: '1.0.0',
          },
        ],
      },
    });

    expect(
      await releaseVersionGenerator(tree, {
        projects: [projectGraph.nodes['@slateui/core']],
        releaseGroup: createReleaseGroup('independent'),
        projectGraph,
        // Bump core to 2.0.0, which will cause buttons and forms to be patched to 1.0.1
        // This prevents a regression against an issue where forms would end up being patched twice to 1.0.2 in this scenario
        specifier: '2.0.0',
        currentVersionResolver: 'disk',
        specifierSource: 'prompt',
      })
    ).toMatchInlineSnapshot(`
      {
        "callback": [Function],
        "data": {
          "@slateui/buttons": {
            "currentVersion": "1.0.0",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "1.0.0",
                "source": "@slateui/forms",
                "target": "@slateui/buttons",
                "type": "static",
              },
            ],
            "newVersion": "1.0.1",
          },
          "@slateui/core": {
            "currentVersion": "1.0.0",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "1.0.0",
                "source": "@slateui/buttons",
                "target": "@slateui/core",
                "type": "static",
              },
              {
                "dependencyCollection": "dependencies",
                "rawVersionSpec": "1.0.0",
                "source": "@slateui/forms",
                "target": "@slateui/core",
                "type": "static",
              },
            ],
            "newVersion": "2.0.0",
          },
          "@slateui/forms": {
            "currentVersion": "1.0.0",
            "dependentProjects": [],
            "newVersion": "1.0.1",
          },
        },
      }
    `);

    expect(readJson(tree, 'packages/core/package.json')).toMatchInlineSnapshot(`
      {
        "name": "@slateui/core",
        "version": "2.0.0",
      }
    `);

    expect(readJson(tree, 'packages/buttons/package.json'))
      .toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@slateui/core": "2.0.0",
        },
        "name": "@slateui/buttons",
        "version": "1.0.1",
      }
    `);

    expect(readJson(tree, 'packages/forms/package.json'))
      .toMatchInlineSnapshot(`
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
});

function createReleaseGroup(
  relationship: ReleaseGroupWithName['projectsRelationship'],
  partialGroup: Partial<ReleaseGroupWithName> = {}
): ReleaseGroupWithName {
  return {
    name: 'myReleaseGroup',
    releaseTagPattern: '{projectName}@v{version}',
    ...partialGroup,
    projectsRelationship: relationship,
  } as ReleaseGroupWithName;
}
