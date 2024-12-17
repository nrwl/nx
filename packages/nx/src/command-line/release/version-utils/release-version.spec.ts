import * as enquirer from 'enquirer';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
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
import { SemverBumpType } from './flexible-version-management';
import { VersionData } from './release-group-processor';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  mockResolveManifestActionsForProjectImplementation,
} from './test-utils';

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
let mockResolveManifestActionsForProject = jest.fn();

jest.doMock('./derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits:
    mockDeriveSpecifierFromConventionalCommits,
}));

jest.doMock('./flexible-version-management', () => ({
  ...jest.requireActual('./flexible-version-management'),
  deriveSpecifierFromVersionPlan: mockDeriveSpecifierFromVersionPlan,
  resolveManifestActionsForProject: mockResolveManifestActionsForProject,
}));

// This does not work with the mocking if we use import
const { ReleaseGroupProcessor } = require('./release-group-processor') as {
  ReleaseGroupProcessor: typeof import('./release-group-processor').ReleaseGroupProcessor;
};

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

type ReleaseVersionGeneratorResult = {
  data: Record<string, VersionData>;
  callback: (
    tree: Tree,
    opts: {
      dryRun?: boolean;
      verbose?: boolean;
      generatorOptions?: Record<string, unknown>;
    }
  ) => Promise<
    | string[]
    | {
        changedFiles: string[];
        deletedFiles: string[];
      }
  >;
};

async function releaseVersionGenerator(
  tree: Tree,
  {
    nxReleaseConfig,
    projectGraph,
    releaseGroups,
    projects,
    userGivenSpecifier,
  }: {
    nxReleaseConfig: NxReleaseConfig;
    projectGraph: ProjectGraph;
    releaseGroups: ReleaseGroupWithName[];
    projects: ProjectGraphProjectNode[];
    userGivenSpecifier: SemverBumpType;
  }
): Promise<ReleaseVersionGeneratorResult> {
  const processor = new ReleaseGroupProcessor(
    tree,
    projectGraph,
    nxReleaseConfig,
    releaseGroups,
    userGivenSpecifier,
    projects.map((p) => p.name)
  );

  await processor.buildGroupGraph();
  // Don't continue if we caught the exit signal, it wouldn't in regular code
  if (processExitSpy.mock.calls.length > 0) {
    return {} as any;
  }
  await processor.processGroups();

  return {
    callback: 'TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION' as any,
    data: processor.getVersionData(),
  };
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

    mockResolveManifestActionsForProject.mockImplementation(
      mockResolveManifestActionsForProjectImplementation
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
    const { nxReleaseConfig, projectGraph, releaseGroups } =
      await createNxReleaseConfigAndPopulateWorkspace(
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
            generatorOptions: {
              specifierSource: 'prompt',
            },
          },
        }
      );

    expect(
      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'major',
        releaseGroups,
      })
    ).toMatchInlineSnapshot(`
      {
        "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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

      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
              },
            },
          }
        );

      tree.delete('my-lib/package.json');

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementation(() => {});

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'major',
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: expect.stringContaining(
          'The project "my-lib" does not have a package.json available'
        ),
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
  });

  describe('package with mixed "prod" and "dev" dependencies', () => {
    it('should update local dependencies only where it needs to', async () => {
      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
              },
            },
          }
        );

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
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
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
              },
            },
          }
        );

      expect(readJson(tree, 'my-lib/package.json').version).toEqual('0.0.1');

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'major',
        releaseGroups,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.0.0');

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'minor',
        releaseGroups,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.1.0');

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'patch',
        releaseGroups,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.1.1');

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: '1.2.3' as SemverBumpType,
        releaseGroups,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.2.3');
    });

    it(`should apply the updated version to the projects, including updating dependents`, async () => {
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
              },
            },
          }
        );

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'major',
        releaseGroups,
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

        const { nxReleaseConfig, projectGraph, releaseGroups } =
          await createNxReleaseConfigAndPopulateWorkspace(
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
                generatorOptions: {
                  specifierSource: 'prompt',
                },
              },
            }
          );

        await releaseVersionGenerator(tree, {
          nxReleaseConfig,
          projects: Object.values(projectGraph.nodes),
          projectGraph,
          // TODO: fix the need for as any
          userGivenSpecifier: '' as any,
          releaseGroups,
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
        const { nxReleaseConfig, projectGraph, releaseGroups } =
          await createNxReleaseConfigAndPopulateWorkspace(
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
                generatorOptions: {
                  specifierSource: 'prompt',
                },
              },
            }
          );

        await releaseVersionGenerator(tree, {
          nxReleaseConfig,
          projects: Object.values(projectGraph.nodes),
          projectGraph,
          userGivenSpecifier: '4.5.6' as SemverBumpType,
          releaseGroups,
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
    });
  });

  describe('updateDependentsOptions', () => {
    // TODO: Figure out if we even need this test, the default has changed
    // it(`should not update dependents when filtering to a subset of projects by default`, async () => {
    //   const { nxReleaseConfig, projectGraph, releaseGroups } =
    //     await createNxReleaseConfigAndPopulateWorkspace(
    //       tree,
    //       `
    //         __default__ ({ "projectsRelationship": "independent" }):
    //           - my-lib@0.0.1 [js]
    //           - project-with-dependency-on-my-pkg@0.0.1 [js]
    //             -> depends on my-lib
    //           - project-with-devDependency-on-my-pkg@0.0.1 [js]
    //             -> depends on my-lib {devDependencies}
    //       `,
    //       {
    //         version: {
    //           generatorOptions: {
    //             specifierSource: 'prompt',
    //           },
    //         },
    //       }
    //     );

    //   await releaseVersionGenerator(tree, {
    //     nxReleaseConfig,
    //     projects: [projectGraph.nodes['my-lib']],
    //     projectGraph,
    //     userGivenSpecifier: '9.9.9' as SemverBumpType,

    //     releaseGroups,
    //   });

    //   expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
    //     {
    //       "name": "my-lib",
    //       "version": "9.9.9",
    //     }
    //   `);

    //   expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
    //     .toMatchInlineSnapshot(`
    //     {
    //       "dependencies": {
    //         "my-lib": "0.0.1",
    //       },
    //       "name": "project-with-dependency-on-my-pkg",
    //       "version": "0.0.1",
    //     }
    //   `);
    //   expect(
    //     readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
    //   ).toMatchInlineSnapshot(`
    //     {
    //       "devDependencies": {
    //         "my-lib": "0.0.1",
    //       },
    //       "name": "project-with-devDependency-on-my-pkg",
    //       "version": "0.0.1",
    //     }
    //   `);
    // });

    it(`should not update dependents when filtering to a subset of projects by default, if "updateDependents" is set to "never"`, async () => {
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
                updateDependents: 'never',
              },
            },
          }
        );

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: [projectGraph.nodes['my-lib']],
        projectGraph,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
        releaseGroups,
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
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
                updateDependents: 'auto',
              },
            },
          }
        );

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: [projectGraph.nodes['my-lib']],
        projectGraph,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
        releaseGroups,
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
  });

  describe('leading v in version', () => {
    it(`should strip a leading v from the provided specifier`, async () => {
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                specifierSource: 'prompt',
              },
            },
          }
        );

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
        userGivenSpecifier: 'v8.8.8' as SemverBumpType,
        releaseGroups,
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
      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              versionPrefix: '',
            },
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
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
      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              versionPrefix: '^',
            },
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
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
      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              versionPrefix: '~',
            },
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
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
      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              versionPrefix: 'auto',
            },
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
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
      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              // No value, should default to "auto"
              versionPrefix: undefined,
            },
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes),
        projectGraph,
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

      const { projectGraph, nxReleaseConfig, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              versionPrefix: '$' as any,
            },
          },
        });

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        releaseGroups,
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        userGivenSpecifier: 'major' as SemverBumpType,
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
    it('should not update transitive dependents when updateDependents is set to "never" and the transitive dependents are not in the same batch', async () => {
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                updateDependents: 'never',
              },
            },
          }
        );

      const result = await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: [projectGraph.nodes['my-lib']],
        projectGraph,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
        releaseGroups,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              generatorOptions: {
                updateDependents: 'auto',
              },
            },
          }
        );

      const result = await releaseVersionGenerator(tree, {
        nxReleaseConfig,
        projects: [projectGraph.nodes['my-lib']],
        projectGraph,
        userGivenSpecifier: '9.9.9' as SemverBumpType,
        releaseGroups,
      });

      expect(result).toMatchInlineSnapshot(`
          {
            "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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
        const { nxReleaseConfig, projectGraph, releaseGroups } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            circularGraphDefinition,
            {
              version: {
                generatorOptions: {
                  updateDependents: 'never',
                },
              },
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
          await releaseVersionGenerator(tree, {
            nxReleaseConfig,
            releaseGroups,
            projects: [projectGraph.nodes['package-a']], // version only package-a
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
        ).toMatchInlineSnapshot(`
        {
          "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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
        const { nxReleaseConfig, projectGraph, releaseGroups } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            circularGraphDefinition,
            {
              version: {
                generatorOptions: {
                  updateDependents: 'never',
                },
              },
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
          await releaseVersionGenerator(tree, {
            nxReleaseConfig,
            releaseGroups,
            projects: [
              projectGraph.nodes['package-a'],
              projectGraph.nodes['package-b'],
            ],
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
        ).toMatchInlineSnapshot(`
        {
          "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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
        const { nxReleaseConfig, projectGraph, releaseGroups } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            circularGraphDefinition,
            {
              version: {
                generatorOptions: {
                  updateDependents: 'auto',
                },
              },
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
          await releaseVersionGenerator(tree, {
            nxReleaseConfig,
            releaseGroups,
            projects: [projectGraph.nodes['package-a']], // version only package-a
            projectGraph,
            userGivenSpecifier: '2.0.0' as SemverBumpType,
          })
        ).toMatchInlineSnapshot(`
        {
          "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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
    });

    it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
      const { nxReleaseConfig, projectGraph, releaseGroups } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          circularGraphDefinition,
          {
            version: {
              generatorOptions: {
                updateDependents: 'auto',
              },
            },
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
        await releaseVersionGenerator(tree, {
          nxReleaseConfig,
          releaseGroups,
          // version both packages
          projects: [
            projectGraph.nodes['package-a'],
            projectGraph.nodes['package-b'],
          ],
          projectGraph,
          userGivenSpecifier: '2.0.0' as SemverBumpType,
        })
      ).toMatchInlineSnapshot(`
        {
          "callback": "TODO__SHOULD_ACTUALLY_BE_A_CALLBACK_FUNCTION",
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
