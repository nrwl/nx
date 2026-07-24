// Module-level mock container - initialized early so jest.mock factories can reference it
const mocks = {
  deriveSpecifierFromConventionalCommits: jest.fn(),
  deriveSpecifierFromVersionPlan: jest.fn(),
  resolveVersionActionsForProject: jest.fn(),
  prompt: jest.fn(),
  // Captures every message that the (mocked) ProjectLogger actually flushes,
  // as `"<projectName> <message>"`, so tests can assert on flushed output.
  flushedProjectLogs: [] as string[],
};

// Aliases for test usage
const mockDeriveSpecifierFromConventionalCommits =
  mocks.deriveSpecifierFromConventionalCommits;
const mockDeriveSpecifierFromVersionPlan = mocks.deriveSpecifierFromVersionPlan;
const mockResolveVersionActionsForProject =
  mocks.resolveVersionActionsForProject;
const mockPrompt = mocks.prompt;

jest.mock('./derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits: (...args: any[]) =>
    mocks.deriveSpecifierFromConventionalCommits(...args),
}));

jest.mock('enquirer', () => ({
  prompt: (...args: any[]) => mocks.prompt(...args),
}));

jest.mock('./version-actions', () => {
  // Defer the actual module access to avoid timing issues with ESM
  let cachedActual: any = null;
  const getActual = () => {
    if (!cachedActual) {
      cachedActual = jest.requireActual('./version-actions');
    }
    return cachedActual;
  };

  return {
    get NOOP_VERSION_ACTIONS() {
      return getActual().NOOP_VERSION_ACTIONS;
    },
    get VersionActions() {
      return getActual().VersionActions;
    },
    get SemverBumpType() {
      return getActual().SemverBumpType;
    },
    deriveSpecifierFromVersionPlan: (...args: any[]) =>
      mocks.deriveSpecifierFromVersionPlan(...args),
    resolveVersionActionsForProject: (...args: any[]) =>
      mocks.resolveVersionActionsForProject(...args),
  };
});

jest.mock('./project-logger', () => {
  const actual = jest.requireActual('./project-logger');
  return {
    ...actual,
    // Faithful-but-silent double: `buffer` accumulates and `flush` "emits" the
    // buffered lines into `mocks.flushedProjectLogs` (mirroring the real flush,
    // which clears the buffer after emitting) instead of printing. This keeps
    // the suite quiet while letting tests assert on what was actually flushed.
    ProjectLogger: class ProjectLogger {
      private logs: string[] = [];

      constructor(private projectName: string) {}

      buffer(msg: string) {
        this.logs.push(msg);
      }

      flush() {
        for (const msg of this.logs) {
          mocks.flushedProjectLogs.push(`${this.projectName} ${msg}`);
        }
        this.logs = [];
      }
    },
  };
});

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
import type { NxReleaseConfig } from '../config/config';
import { VersionData } from '../utils/shared';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  createTestReleaseGroupProcessor,
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
    userGivenSpecifier,
    filters,
    preid,
  }: {
    nxReleaseConfig: NxReleaseConfig;
    projectGraph: ProjectGraph;
    userGivenSpecifier: SemverBumpType | undefined;
    filters?: {
      projects?: string[];
      groups?: string[];
    };
    preid?: string;
  }
): Promise<ReleaseVersionGeneratorResult> {
  try {
    const processor = await createTestReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      filters || {},
      {
        firstRelease: false,
        preid,
        userGivenSpecifier,
      }
    );

    await processor.processGroups();

    return {
      callback: async () => {
        /**
         * Pass in the root level release.version.versionActionsOptions (release group and project level options are not respected here
         * because this takes place after all projects have been versioned)
         */
        return processor.afterAllProjectsVersioned(
          (nxReleaseConfig.version as NxReleaseVersionConfiguration)
            .versionActionsOptions ?? {}
        );
      },
      data: processor.getVersionData(),
    };
  } catch (e: any) {
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

    mocks.flushedProjectLogs.length = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
    stubProcessExit = false;
  });
  afterAll(() => {
    process.exit = originalExit;
  });

  it('should return a versionData object', async () => {
    const { nxReleaseConfig, projectGraph, filters } =
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
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
          },
        }
      );

    expect(
      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'major',
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
            "newVersion": "0.1.0",
          },
          "project-with-dependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "0.1.0",
          },
          "project-with-devDependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "0.1.0",
          },
        },
      }
    `);
  });

  describe('not all given projects have package.json files', () => {
    it(`should exit with code one and print guidance when not all of the given projects are appropriate for JS versioning`, async () => {
      stubProcessExit = true;

      const { nxReleaseConfig, projectGraph, filters } =
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
              specifierSource: 'prompt',
              adjustSemverBumpsForZeroMajorVersion: true,
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
        userGivenSpecifier: 'major',
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: expect.stringContaining(
          'The project "my-lib" does not have a package.json file available in my-lib'
        ),
      });

      outputSpy.mockRestore();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      stubProcessExit = false;
    });
  });

  describe('package with mixed "prod" and "dev" dependencies', () => {
    it('should update local dependencies only where it needs to', async () => {
      const { projectGraph, nxReleaseConfig, filters } =
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
              specifierSource: 'prompt',
              adjustSemverBumpsForZeroMajorVersion: true,
            },
          }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        filters,
        projectGraph,
        userGivenSpecifier: 'major',
      });

      expect(readJson(tree, 'my-app/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "my-lib-1": "0.1.0",
          },
          "devDependencies": {
            "my-lib-2": "0.1.0",
          },
          "name": "my-app",
          "version": "0.1.0",
        }
      `);
    });
  });

  describe('fixed release group', () => {
    it(`should work with semver keywords and exact semver versions`, async () => {
      const { nxReleaseConfig, projectGraph, filters } =
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
              specifierSource: 'prompt',
              adjustSemverBumpsForZeroMajorVersion: true,
            },
          }
        );

      expect(readJson(tree, 'my-lib/package.json').version).toEqual('0.0.1');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'major',
      });
      // 0.0.1 + major = 0.1.0 (0.x versioning: major bumps minor)
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('0.1.0');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'minor',
      });
      // 0.1.0 + minor = 0.1.1 (0.x versioning: minor bumps patch)
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('0.1.1');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch',
      });
      // 0.1.1 + patch = 0.1.2
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('0.1.2');

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: '1.2.3' as SemverBumpType,
      });
      expect(readJson(tree, 'my-lib/package.json').version).toEqual('1.2.3');
    });

    it(`should apply the updated version to the projects, including updating dependents`, async () => {
      const { nxReleaseConfig, projectGraph, filters } =
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
              specifierSource: 'prompt',
              adjustSemverBumpsForZeroMajorVersion: true,
            },
          }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'major',
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
          "version": "0.1.0",
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
          "version": "0.1.0",
        }
      `);
    });
  });

  describe('independent release group', () => {
    describe('specifierSource: prompt', () => {
      it(`should appropriately prompt for each project independently and apply the version updates across all manifest files`, async () => {
        stubProcessExit = true;
        // First project will be minor
        mockPrompt
          .mockReturnValueOnce(Promise.resolve({ specifier: 'minor' }))
          // Next project will be patch
          .mockReturnValueOnce(Promise.resolve({ specifier: 'patch' }))
          // Final project will be custom explicit version (1.2.3)
          // For custom version, first prompt returns 'custom', then second prompt returns the version
          .mockReturnValueOnce(Promise.resolve({ specifier: 'custom' }))
          .mockReturnValueOnce(Promise.resolve({ specifier: '1.2.3' }));

        const { nxReleaseConfig, projectGraph, filters } =
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
                specifierSource: 'prompt',
                adjustSemverBumpsForZeroMajorVersion: true,
              },
            }
          );

        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: undefined,
        });

        // 0.0.1 + minor = 0.0.2 (0.x versioning: minor bumps patch)
        expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
          {
            "name": "my-lib",
            "version": "0.0.2",
          }
        `);

        expect(readJson(tree, 'project-with-dependency-on-my-pkg/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "my-lib": "0.0.2",
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
              "my-lib": "0.0.2",
            },
            "name": "project-with-devDependency-on-my-pkg",
            "version": "1.2.3",
          }
        `);
      });
      it(`should respect an explicit user CLI specifier for all, even when projects are independent, and apply the version updates across all manifest files`, async () => {
        const { nxReleaseConfig, projectGraph, filters } =
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
                specifierSource: 'prompt',
                adjustSemverBumpsForZeroMajorVersion: true,
              },
            }
          );

        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: '4.5.6' as SemverBumpType,
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
          const { nxReleaseConfig, projectGraph, filters } =
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
                  specifierSource: 'prompt',
                  adjustSemverBumpsForZeroMajorVersion: true,
                  // No value for updateDependents, should default to 'always'
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
          const { nxReleaseConfig, projectGraph, filters } =
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
                  specifierSource: 'prompt',
                  adjustSemverBumpsForZeroMajorVersion: true,
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
          const { nxReleaseConfig, projectGraph, filters } =
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
                  specifierSource: 'prompt',
                  adjustSemverBumpsForZeroMajorVersion: true,
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

        it('should not apply preid to dependent patch bumps by default when --preid is set', async () => {
          const { nxReleaseConfig, projectGraph, filters } =
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
                  specifierSource: 'prompt',
                  adjustSemverBumpsForZeroMajorVersion: true,
                  updateDependents: 'auto',
                },
              },
              undefined,
              {
                projects: ['my-lib'],
              }
            );

          // Default behavior (applyPreidToDependents unset): dependents only
          // get a stable patch bump even though the bumped project is a prerelease.
          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            filters,
            projectGraph,
            userGivenSpecifier: 'prepatch' as SemverBumpType,
            preid: 'rc',
          });

          expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "0.0.2-rc.0",
            }
          `);

          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "0.0.2-rc.0",
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
                "my-lib": "0.0.2-rc.0",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.2",
            }
          `);
        });

        it('should apply preid to dependent patch bumps when applyPreidToDependents is enabled and --preid is set', async () => {
          const { nxReleaseConfig, projectGraph, filters } =
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
                  specifierSource: 'prompt',
                  adjustSemverBumpsForZeroMajorVersion: true,
                  updateDependents: 'auto',
                  applyPreidToDependents: true,
                },
              },
              undefined,
              {
                projects: ['my-lib'],
              }
            );

          // With applyPreidToDependents: true, dependents that are only
          // receiving a dependent patch bump are upgraded to prepatch so the
          // preid is actually applied.
          await releaseVersionGeneratorForTest(tree, {
            nxReleaseConfig,
            filters,
            projectGraph,
            userGivenSpecifier: 'prepatch' as SemverBumpType,
            preid: 'rc',
          });

          expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
            {
              "name": "my-lib",
              "version": "0.0.2-rc.0",
            }
          `);

          expect(
            readJson(tree, 'project-with-dependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "dependencies": {
                "my-lib": "0.0.2-rc.0",
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.2-rc.0",
            }
          `);
          expect(
            readJson(tree, 'project-with-devDependency-on-my-pkg/package.json')
          ).toMatchInlineSnapshot(`
            {
              "devDependencies": {
                "my-lib": "0.0.2-rc.0",
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "0.0.2-rc.0",
            }
          `);
        });

        it('should update dependents with a prepatch when creating a pre-release version', async () => {
          const { nxReleaseConfig, projectGraph, filters } =
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
                  specifierSource: 'prompt',
                  adjustSemverBumpsForZeroMajorVersion: true,
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
      const { nxReleaseConfig, projectGraph, filters } =
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
              specifierSource: 'prompt',
              adjustSemverBumpsForZeroMajorVersion: true,
            },
          }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'v8.8.8' as SemverBumpType,
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
      const { projectGraph, nxReleaseConfig, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
            versionPrefix: '',
            preserveMatchingDependencyRanges: false,
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
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
      const { projectGraph, nxReleaseConfig, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
            versionPrefix: '^',
            preserveMatchingDependencyRanges: false,
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
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
      const { projectGraph, nxReleaseConfig, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
            versionPrefix: '~',
            preserveMatchingDependencyRanges: false,
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
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
      const { projectGraph, nxReleaseConfig, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
            versionPrefix: 'auto',
            preserveMatchingDependencyRanges: false,
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
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
      const { projectGraph, nxReleaseConfig, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
            // No value, should default to "auto"
            versionPrefix: undefined,
            preserveMatchingDependencyRanges: false,
          },
        });

      // Manually set different version prefixes
      setDifferentVersionPrefixes(tree);

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
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

      const { projectGraph, nxReleaseConfig, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(tree, graphDefinition, {
          version: {
            specifierSource: 'prompt',
            adjustSemverBumpsForZeroMajorVersion: true,
            versionPrefix: '$' as any,
          },
        });

      const outputSpy = jest
        .spyOn(output, 'error')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
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
      const { nxReleaseConfig, projectGraph, filters } =
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
      const { nxReleaseConfig, projectGraph, filters } =
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
              updateDependents: 'auto',
              preserveMatchingDependencyRanges: false,
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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              adjustSemverBumpsForZeroMajorVersion: true,
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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              adjustSemverBumpsForZeroMajorVersion: true,
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

  // Regression coverage for the subset-release bug: when releasing ONLY a
  // dependent project, its local (workspace:/file:) dependencies on packages
  // that are NOT part of the release set were left unresolved in the manifest
  // (even with preserveLocalDependencyProtocols: false), because the
  // out-of-set dependency never entered `dependenciesToUpdate`.
  describe('out-of-set local dependencies on a subset release', () => {
    it('should resolve and rewrite an out-of-set `workspace:` dependency to a concrete version when preserveLocalDependencyProtocols is false', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - package-a@1.0.0 [js]
                -> depends on package-b(workspace:*)
                -> depends on package-b(workspace:*) {peerDependencies}
              - package-b@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          {
            // Release ONLY package-a (the dependent). package-b is NOT released
            // and is therefore not part of allProjectsToProcess.
            projects: ['package-a'],
          }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      const packageA = readJson(tree, 'package-a/package.json');
      expect(packageA.version).toBe('1.0.1');
      // The bug: these used to remain "workspace:*". They must resolve to
      // package-b's concrete current version (2.5.0), resolved via package-b's
      // own configured currentVersionResolver.
      expect(packageA.dependencies['package-b']).toBe('2.5.0');
      expect(packageA.peerDependencies['package-b']).toBe('2.5.0');

      // package-b was not released, so its own version stays untouched.
      expect(readJson(tree, 'package-b/package.json').version).toBe('2.5.0');
    });

    it('should preserve the semver range prefix when rewriting an out-of-set `workspace:^` dependency', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - package-c@1.0.0 [js]
                -> depends on package-d(workspace:^)
              - package-d@3.1.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['package-c'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      // workspace:^ must become ^<resolved version>, not a bare version.
      expect(
        readJson(tree, 'package-c/package.json').dependencies['package-d']
      ).toBe('^3.1.0');
    });

    it('should keep the local protocol untouched when preserveLocalDependencyProtocols is true', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - package-e@1.0.0 [js]
                -> depends on package-f(workspace:*)
              - package-f@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: true,
            },
          },
          undefined,
          { projects: ['package-e'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      // preserve=true: the protocol must be kept as-is.
      expect(
        readJson(tree, 'package-e/package.json').dependencies['package-f']
      ).toBe('workspace:*');
    });

    it('should resolve an out-of-set `file:` dependency to the exact resolved version', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-file-src@1.0.0 [js]
                -> depends on pkg-file-dep(file:../pkg-file-dep)
              - pkg-file-dep@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-file-src'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      // file: has no range semantics, so it resolves to the exact version.
      expect(
        readJson(tree, 'pkg-file-src/package.json').dependencies['pkg-file-dep']
      ).toBe('2.5.0');
    });

    it('should preserve the `~` range prefix when rewriting an out-of-set `workspace:~` dependency', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-tilde-src@1.0.0 [js]
                -> depends on pkg-tilde-dep(workspace:~)
              - pkg-tilde-dep@3.1.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-tilde-src'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      expect(
        readJson(tree, 'pkg-tilde-src/package.json').dependencies[
          'pkg-tilde-dep'
        ]
      ).toBe('~3.1.0');
    });

    it('should pass pinned `workspace:` ranges through verbatim (pnpm publish parity) without resolving the current version', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-pin-src@1.0.0 [js]
                -> depends on pkg-pin-caret(workspace:^1.2.3)
                -> depends on pkg-pin-exact(workspace:2.5.0) {peerDependencies}
              - pkg-pin-caret@9.9.9 [js]
              - pkg-pin-exact@8.8.8 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-pin-src'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      const pkg = readJson(tree, 'pkg-pin-src/package.json');
      // The user-authored ranges must survive verbatim - NOT be rewritten to
      // the deps' resolved current versions (9.9.9 / 8.8.8).
      expect(pkg.dependencies['pkg-pin-caret']).toBe('^1.2.3');
      expect(pkg.peerDependencies['pkg-pin-exact']).toBe('2.5.0');
    });

    it('should leave an out-of-set dependency referenced via a plain registry range untouched', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-reg-src@1.0.0 [js]
                -> depends on pkg-reg-dep(^2.0.0)
              - pkg-reg-dep@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-reg-src'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      // Not a local protocol -> out of scope for on-demand resolution.
      expect(
        readJson(tree, 'pkg-reg-src/package.json').dependencies['pkg-reg-dep']
      ).toBe('^2.0.0');
    });

    it('should apply an explicit versionPrefix to a rewritten out-of-set `workspace:*` dependency', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-pref-src@1.0.0 [js]
                -> depends on pkg-pref-dep(workspace:*)
              - pkg-pref-dep@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
              versionPrefix: '^',
            },
          },
          undefined,
          { projects: ['pkg-pref-src'] }
        );

      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      // Explicit versionPrefix '^' wins over the bare 'workspace:*' (exact).
      expect(
        readJson(tree, 'pkg-pref-src/package.json').dependencies['pkg-pref-dep']
      ).toBe('^2.5.0');
    });

    it('should complete the release and leave the protocol untouched when an out-of-set dependency version cannot be resolved (currentVersionResolver "none")', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-none-src@1.0.0 [js]
                -> depends on pkg-none-dep(workspace:*)
              - pkg-none-dep@2.5.0 [js]
                -> release config overrides { "version": { "currentVersionResolver": "none" } }
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-none-src'] }
        );

      // The released project resolves from disk; only the out-of-set dependency
      // is unresolvable (its own currentVersionResolver is 'none').
      await releaseVersionGeneratorForTest(tree, {
        nxReleaseConfig,
        projectGraph,
        filters,
        userGivenSpecifier: 'patch' as SemverBumpType,
      });

      const pkg = readJson(tree, 'pkg-none-src/package.json');
      expect(pkg.version).toBe('1.0.1');
      // Unresolvable dependency -> protocol left untouched, release still ran.
      expect(pkg.dependencies['pkg-none-dep']).toBe('workspace:*');
    });

    it('should not fail the release when resolving an out-of-set dependency version throws', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-throw-src@1.0.0 [js]
                -> depends on pkg-throw-dep(workspace:*)
              - pkg-throw-dep@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-throw-src'] }
        );

      // Force resolveCurrentVersion to reject for the out-of-set dependency,
      // simulating e.g. a git-tag resolver with no matching tag and no fallback.
      const resolveCurrentVersionModule = require('./resolve-current-version');
      const original = resolveCurrentVersionModule.resolveCurrentVersion;
      const spy = jest
        .spyOn(resolveCurrentVersionModule, 'resolveCurrentVersion')
        .mockImplementation(((...args: any[]) => {
          const projectGraphNode = args[1];
          if (projectGraphNode?.name === 'pkg-throw-dep') {
            return Promise.reject(
              new Error('simulated current-version resolution failure')
            );
          }
          return original(...args);
        }) as any);

      try {
        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: 'patch' as SemverBumpType,
        });
      } finally {
        spy.mockRestore();
      }

      const pkg = readJson(tree, 'pkg-throw-src/package.json');
      // Released project still versioned; failing dep left as workspace:*.
      expect(pkg.version).toBe('1.0.1');
      expect(pkg.dependencies['pkg-throw-dep']).toBe('workspace:*');
    });

    it('should resolve an out-of-set `workspace:*` dependency from git tags when the on-disk version is a placeholder (motivating customer scenario)', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-tag-src@1.0.0 [js]
                -> depends on pkg-tag-dep(workspace:*)
              - pkg-tag-dep@0.0.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'git-tag',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-tag-src'] }
        );

      // The real versions live only in git tags (on-disk pkg-tag-dep is 0.0.0).
      // Mock the tag lookup so pkg-tag-dep resolves to 4.2.0 from a tag.
      const gitModule = require('../utils/git');
      const versionsByProject: Record<string, string> = {
        'pkg-tag-src': '1.0.0',
        'pkg-tag-dep': '4.2.0',
      };
      const spy = jest
        .spyOn(gitModule, 'getLatestGitTagForPattern')
        .mockImplementation(((_pattern: any, { projectName }: any) => {
          const extractedVersion = versionsByProject[projectName];
          if (!extractedVersion) {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            tag: `${projectName}@${extractedVersion}`,
            extractedVersion,
          });
        }) as any);

      try {
        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: 'patch' as SemverBumpType,
        });
      } finally {
        spy.mockRestore();
      }

      // Must be the git-tag version (4.2.0), NOT the on-disk placeholder 0.0.0.
      expect(
        readJson(tree, 'pkg-tag-src/package.json').dependencies['pkg-tag-dep']
      ).toBe('4.2.0');
    });

    it('should surface the unresolvable-dependency warning even when the dependency is in a different, filtered-out release group', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            groupA ({ "projectsRelationship": "independent" }):
              - pkg-warn-src@1.0.0 [js]
                -> depends on pkg-warn-dep(workspace:*)
            groupB ({ "projectsRelationship": "independent" }):
              - pkg-warn-dep@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          // Release ONLY pkg-warn-src (groupA). pkg-warn-dep lives in groupB,
          // which is filtered out and whose processGroup never runs.
          { projects: ['pkg-warn-src'] }
        );

      // Force resolveCurrentVersion to throw for the out-of-set dependency so
      // that the catch block buffers its remediation warning.
      const resolveCurrentVersionModule = require('./resolve-current-version');
      const original = resolveCurrentVersionModule.resolveCurrentVersion;
      const spy = jest
        .spyOn(resolveCurrentVersionModule, 'resolveCurrentVersion')
        .mockImplementation(((...args: any[]) => {
          const projectGraphNode = args[1];
          if (projectGraphNode?.name === 'pkg-warn-dep') {
            return Promise.reject(
              new Error('simulated current-version resolution failure')
            );
          }
          return original(...args);
        }) as any);

      try {
        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: 'patch' as SemverBumpType,
        });
      } finally {
        spy.mockRestore();
      }

      // Release still completed and left the protocol untouched.
      expect(
        readJson(tree, 'pkg-warn-src/package.json').dependencies['pkg-warn-dep']
      ).toBe('workspace:*');

      // The warning must have been flushed (surfaced to the user), even though
      // pkg-warn-dep's release group was never processed.
      const warnings = mocks.flushedProjectLogs.filter((line) =>
        line.includes('Could not resolve the current version of "pkg-warn-dep"')
      );
      expect(warnings).toHaveLength(1);
    });

    it('should surface the unresolvable-dependency warning exactly once when the dependency is in the same release group', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            __default__ ({ "projectsRelationship": "independent" }):
              - pkg-same-src@1.0.0 [js]
                -> depends on pkg-same-dep(workspace:*)
              - pkg-same-dep@2.5.0 [js]
            `,
          {
            version: {
              specifierSource: 'prompt',
              currentVersionResolver: 'disk',
              preserveLocalDependencyProtocols: false,
            },
          },
          undefined,
          { projects: ['pkg-same-src'] }
        );

      const resolveCurrentVersionModule = require('./resolve-current-version');
      const original = resolveCurrentVersionModule.resolveCurrentVersion;
      const spy = jest
        .spyOn(resolveCurrentVersionModule, 'resolveCurrentVersion')
        .mockImplementation(((...args: any[]) => {
          const projectGraphNode = args[1];
          if (projectGraphNode?.name === 'pkg-same-dep') {
            return Promise.reject(
              new Error('simulated current-version resolution failure')
            );
          }
          return original(...args);
        }) as any);

      try {
        await releaseVersionGeneratorForTest(tree, {
          nxReleaseConfig,
          projectGraph,
          filters,
          userGivenSpecifier: 'patch' as SemverBumpType,
        });
      } finally {
        spy.mockRestore();
      }

      // The immediate catch flush emits it and clears the buffer, so the group's
      // own end-of-processGroup flush does not print it a second time.
      const warnings = mocks.flushedProjectLogs.filter((line) =>
        line.includes('Could not resolve the current version of "pkg-same-dep"')
      );
      expect(warnings).toHaveLength(1);
    });
  });

  it('should not double patch transitive dependents that are already direct dependents', async () => {
    const { nxReleaseConfig, projectGraph, filters } =
      await createNxReleaseConfigAndPopulateWorkspace(
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
            adjustSemverBumpsForZeroMajorVersion: true,
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

          const { nxReleaseConfig, projectGraph, filters } =
            await createNxReleaseConfigAndPopulateWorkspace(
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

          const { nxReleaseConfig, projectGraph, filters } =
            await createNxReleaseConfigAndPopulateWorkspace(
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
