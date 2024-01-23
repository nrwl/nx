let originalExit = process.exit;
let stubProcessExit = false;

const processExitSpy = jest
  .spyOn(process, 'exit')
  .mockImplementation((...args) => {
    if (stubProcessExit) {
      return undefined as never;
    }
    return originalExit(...args);
  });

import { ProjectGraph, Tree, output, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ReleaseGroupWithName } from 'nx/src/command-line/release/config/filter-release-groups';
import { releaseVersionGenerator } from './release-version';
import { createWorkspaceWithPackageDependencies } from './test-utils/create-workspace-with-package-dependencies';
import * as enquirer from 'enquirer';

jest.mock('enquirer');

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

describe('release-version', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    // @ts-ignore
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
                "source": "project-with-dependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
              {
                "dependencyCollection": "devDependencies",
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

      it(`should update dependents even when filtering to a subset of projects which do not include those dependents`, async () => {
        expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual(
          '0.0.1'
        );
        expect(
          readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
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
        });

        expect(readJson(tree, 'libs/my-lib/package.json'))
          .toMatchInlineSnapshot(`
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
              "my-lib": "9.9.9",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "0.0.1",
          }
        `);
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
        versionPrefix: '$',
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: `Invalid value for version.generatorOptions.versionPrefix: "$"

Valid values are: "auto", "", "~", "^"`,
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
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
