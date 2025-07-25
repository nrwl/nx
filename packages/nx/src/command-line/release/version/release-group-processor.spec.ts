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

jest.doMock('./project-logger', () => ({
  ...jest.requireActual('./project-logger'),
  // Don't slow down or add noise to unit tests output unnecessarily
  ProjectLogger: class ProjectLogger {
    buffer() {}
    flush() {}
  },
}));

let mockResolveCurrentVersion = jest.fn();
jest.doMock('./resolve-current-version', () => ({
  resolveCurrentVersion: mockResolveCurrentVersion,
}));

import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../../generators/tree';
import { readJson, updateJson } from '../../../generators/utils/json';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  mockResolveVersionActionsForProjectImplementation,
} from './test-utils';

// This does not work with the mocking if we use import
const { ReleaseGroupProcessor } = require('./release-group-processor') as {
  ReleaseGroupProcessor: typeof import('./release-group-processor').ReleaseGroupProcessor;
};

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

describe('ReleaseGroupProcessor', () => {
  let tree: Tree;

  beforeEach(() => {
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
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('should handle a single default group with fixed versioning, with no project dependency relationships', async () => {
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
        preid: undefined,
        filters,
      }
    );
    await processor.init();

    mockDeriveSpecifierFromConventionalCommits.mockImplementation(() => {
      // This should only be called once for this group (for the first project)
      return 'minor';
    });
    await processor.processGroups();

    // All projects should be bumped to the same version as required by the first project
    expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(1);
    expect(readJson(tree, 'projectA/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectA",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectB/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectB",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectC/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectC",
        "version": "1.1.0",
      }
    `);
  });

  it('should handle a single default group with fixed versioning, with project dependency relationships', async () => {
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
            - projectD@1.0.0 [js]
              -> depends on projectE
            - projectE@1.0.0 [js]
              -> depends on projectF
            - projectF@1.0.0 [js]
        `,
      {
        version: {
          conventionalCommits: true,
        },
      },
      mockResolveCurrentVersion
    );

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
        preid: undefined,
        filters,
      }
    );
    await processor.init();

    mockDeriveSpecifierFromConventionalCommits.mockImplementation(() => {
      // This should only be called once for this group (for the first project)
      return 'minor';
    });
    await processor.processGroups();

    // All projects should be bumped to the same version as required by the first project (the project dependency relationships do not affect this)
    expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(1);
    expect(readJson(tree, 'projectD/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "projectE": "1.1.0",
        },
        "name": "projectD",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectE/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "projectF": "1.1.0",
        },
        "name": "projectE",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectF/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectF",
        "version": "1.1.0",
      }
    `);
  });

  it('should handle a single default group with fixed versioning, with project dependency relationships when using scoped packages which do not match their project names', async () => {
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
            - projectD@1.0.0 [js:@myorg/projectD]
              -> depends on projectE
            - projectE@1.0.0 [js:@myorg/projectE]
              -> depends on projectF
            - projectF@1.0.0 [js:@myorg/projectF]
        `,
      {
        version: {
          conventionalCommits: true,
        },
      },
      mockResolveCurrentVersion
    );

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
        preid: undefined,
        filters,
      }
    );
    await processor.init();

    mockDeriveSpecifierFromConventionalCommits.mockImplementation(() => {
      // This should only be called once for this group (for the first project)
      return 'minor';
    });
    await processor.processGroups();

    // All projects should be bumped to the same version as required by the first project (the project dependency relationships do not affect this)
    expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(1);
    expect(readJson(tree, 'projectD/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@myorg/projectE": "1.1.0",
        },
        "name": "@myorg/projectD",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectE/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@myorg/projectF": "1.1.0",
        },
        "name": "@myorg/projectE",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectF/package.json')).toMatchInlineSnapshot(`
      {
        "name": "@myorg/projectF",
        "version": "1.1.0",
      }
    `);
  });

  it('should handle a single default group with independent versioning, with no project dependency relationships', async () => {
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
            - projectG@1.0.0 [js]
            - projectH@2.0.0 [js]
            - projectI@3.0.0 [js]
        `,
      {
        version: {
          conventionalCommits: true,
        },
      },
      mockResolveCurrentVersion
    );

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
        preid: undefined,
        filters,
      }
    );

    await processor.init();

    mockDeriveSpecifierFromConventionalCommits.mockImplementation(
      (_, __, ___, ____, { name: projectName }) => {
        if (projectName === 'projectG') return 'minor';
        if (projectName === 'projectH') return 'patch';
        return 'none';
      }
    );
    await processor.processGroups();

    // Each project should have its own specifier independently resolved
    expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(3);

    // The new versions are based on the individually derived specifiers and previous versions
    expect(readJson(tree, 'projectG/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectG",
        "version": "1.1.0",
      }
    `);
    expect(readJson(tree, 'projectH/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectH",
        "version": "2.0.1",
      }
    `);
    expect(readJson(tree, 'projectI/package.json')).toMatchInlineSnapshot(`
      {
        "name": "projectI",
        "version": "3.0.0",
      }
    `);
  });

  describe('independent group with project dependency relationships within it', () => {
    let processor: import('./release-group-processor').ReleaseGroupProcessor;
    let tree: Tree;

    // Share a tree, project graph and release groups setup between these tests
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
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
            - projectJ@1.0.0 [js]
              -> depends on projectK
            - projectK@2.0.0 [js]
              -> depends on projectL
            - projectL@3.0.0 [js]
        `,
        {
          version: {
            conventionalCommits: true,
          },
        },
        mockResolveCurrentVersion
      );

      processor = new ReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        releaseGroups,
        releaseGroupToFilteredProjects,
        {
          dryRun: false,
          verbose: false,
          firstRelease: false,
          preid: undefined,
          filters,
        }
      );
      await processor.init();
    });

    it('should not bump anything when no specifiers are resolved', async () => {
      mockDeriveSpecifierFromConventionalCommits.mockImplementation(() => {
        return 'none';
      });
      await processor.processGroups();

      // Called for each project
      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        3
      );

      // All projects unchanged
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "2.0.0",
          },
          "name": "projectJ",
          "version": "1.0.0",
        }
      `);
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectL": "3.0.0",
          },
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.0.0",
        }
      `);
    });

    it('should only bump projects based on their own specifiers if no dependencies have resolved specifiers', async () => {
      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // Only projectJ has a specifier, it is not depended on by anything else
          if (projectName === 'projectJ') return 'minor';
          return 'none';
        }
      );
      await processor.processGroups();

      // Called for each project
      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        3
      );

      // Only projectJ is bumped
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "2.0.0",
          },
          "name": "projectJ",
          "version": "1.1.0",
        }
      `);
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectL": "3.0.0",
          },
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.0.0",
        }
      `);
    });

    it('should handle projects with mixed dependency types', async () => {
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
              - projectM@1.0.0 [js]
                -> depends on projectN
                -> depends on projectO {devDependencies}
                -> depends on projectP {peerDependencies}
              - projectN@1.0.0 [js]
              - projectO@1.0.0 [js]
              - projectP@1.0.0 [js]
          `,
        {
          version: {
            conventionalCommits: true,
          },
        },
        mockResolveCurrentVersion
      );

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
          preid: undefined,
          filters,
        }
      );

      await processor.init();

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          if (projectName === 'projectM') return 'minor';
          if (projectName === 'projectN') return 'patch';
          if (projectName === 'projectO') return 'major';
          return 'none';
        }
      );
      await processor.processGroups();

      // projectM is bumped by minor, and its dependencies are updated accordingly
      expect(readJson(tree, 'projectM/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectN": "1.0.1",
          },
          "devDependencies": {
            "projectO": "2.0.0",
          },
          "name": "projectM",
          "peerDependencies": {
            "projectP": "1.0.0",
          },
          "version": "1.1.0",
        }
      `);
      // projectN is bumped by patch
      expect(readJson(tree, 'projectN/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectN",
          "version": "1.0.1",
        }
      `);
      // projectO is bumped by major
      expect(readJson(tree, 'projectO/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectO",
          "version": "2.0.0",
        }
      `);
      // projectP is not bumped
      expect(readJson(tree, 'projectP/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectP",
          "version": "1.0.0",
        }
      `);
    });

    describe('mixed ecosystems', () => {
      it('should handle a single fixed group containing both rust and js projects with separate dependency relationships', async () => {
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
                - rustLibA@1.0.0 [rust]
                - rustLibB@1.0.0 [rust]
                  -> depends on rustLibA
                - jsPackageX@1.0.0 [js]
                - jsPackageY@1.0.0 [js]
                  -> depends on jsPackageX
            `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

        // Initial state of rustLibA
        expect(tree.read('rustLibA/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibA'
          version = '1.0.0'
          "
        `);

        // Initial state of rustLibB
        expect(tree.read('rustLibB/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibB'
          version = '1.0.0'

          [dependencies]
          rustLibA = { version = '1.0.0' }
          "
        `);

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
            preid: undefined,
            filters,
          }
        );
        await processor.init();

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(() => {
          // This should only be called once for this group (for the first project)
          return 'minor';
        });
        await processor.processGroups();

        // All projects should be bumped to the same version as required by the first project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(1);

        // rustLibA is bumped by minor
        expect(tree.read('rustLibA/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibA'
          version = '1.1.0'
          "
        `);

        // rustLibB is bumped by minor, and its dependency on rustLibA is updated
        expect(tree.read('rustLibB/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibB'
          version = '1.1.0'

          [dependencies]
          rustLibA = '1.1.0'
          "
        `);

        // jsPackageX is bumped by minor
        expect(readJson(tree, 'jsPackageX/package.json'))
          .toMatchInlineSnapshot(`
          {
            "name": "jsPackageX",
            "version": "1.1.0",
          }
        `);

        // jsPackageY is bumped by minor, and its dependency on jsPackageX is updated
        expect(readJson(tree, 'jsPackageY/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "jsPackageX": "1.1.0",
            },
            "name": "jsPackageY",
            "version": "1.1.0",
          }
        `);
      });

      it('should handle a single independent group containing both rust and js projects with separate dependency relationships', async () => {
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
                - rustLibA@1.0.0 [rust]
                - rustLibB@2.0.0 [rust]
                  -> depends on rustLibA
                - jsPackageX@3.0.0 [js]
                - jsPackageY@4.0.0 [js]
                  -> depends on jsPackageX
            `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

        // Initial state of rustLibA
        expect(tree.read('rustLibA/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibA'
          version = '1.0.0'
          "
        `);

        // Initial state of rustLibB
        expect(tree.read('rustLibB/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibB'
          version = '2.0.0'

          [dependencies]
          rustLibA = { version = '1.0.0' }
          "
        `);

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
            preid: undefined,
            filters,
          }
        );
        await processor.init();

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            if (projectName === 'rustLibA') return 'minor';
            if (projectName === 'rustLibB') return 'patch';
            if (projectName === 'jsPackageX') return 'major';
            if (projectName === 'jsPackageY') return 'minor';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(4);

        // rustLibA is bumped by minor
        expect(tree.read('rustLibA/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibA'
          version = '1.1.0'
          "
        `);

        // rustLibB is bumped by updateDependents default of "patch", and its dependency on rustLibA is updated
        expect(tree.read('rustLibB/Cargo.toml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "
          [package]
          name = 'rustLibB'
          version = '2.0.1'

          [dependencies]
          rustLibA = '1.1.0'
          "
        `);

        // jsPackageX is bumped by major
        expect(readJson(tree, 'jsPackageX/package.json'))
          .toMatchInlineSnapshot(`
          {
            "name": "jsPackageX",
            "version": "4.0.0",
          }
        `);

        // jsPackageY is bumped by minor, and its dependency on jsPackageX is updated
        expect(readJson(tree, 'jsPackageY/package.json'))
          .toMatchInlineSnapshot(`
          {
            "dependencies": {
              "jsPackageX": "4.0.0",
            },
            "name": "jsPackageY",
            "version": "4.1.0",
          }
        `);
      });
    });

    describe('updateDependents', () => {
      it('should bump projects if their dependencies have resolved specifiers, even when they have not resolved their own specifiers, when updateDependents is set to its default of "auto" - SINGLE LEVEL DEPENDENCY', async () => {
        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // Only projectK has a specifier. This should cause both itself and projectJ to be bumped.
            if (projectName === 'projectK') return 'minor';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(3);

        // projectJ is bumped by the default updateDependents bump of "patch"
        expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectK": "2.1.0",
            },
            "name": "projectJ",
            "version": "1.0.1",
          }
        `);
        // projectK is bumped based on its own specifier of minor
        expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectL": "3.0.0",
            },
            "name": "projectK",
            "version": "2.1.0",
          }
        `);
        // projectL is not bumped because it has no specifier and does not depend on projects that do
        expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectL",
            "version": "3.0.0",
          }
        `);
      });

      it('should bump projects if their dependencies have resolved specifiers, even when they have not resolved their own specifiers, when updateDependents is set to its default of "auto" - TRANSITIVE DEPENDENCY', async () => {
        // This time bump projectL which should cause a cascade of bumps across projectK and projectJ
        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // Only projectL has a specifier. This should cause itself to be bumped by a major, and projectK and projectJ to be bumped by a patch.
            if (projectName === 'projectL') return 'major';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(3);

        // projectJ is bumped by the default updateDependents bump of "patch"
        expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectK": "2.0.1",
            },
            "name": "projectJ",
            "version": "1.0.1",
          }
        `);
        // projectK is bumped by the default updateDependents bump of "patch"
        expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectL": "4.0.0",
            },
            "name": "projectK",
            "version": "2.0.1",
          }
        `);
        // projectL is bumped by a major
        expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectL",
            "version": "4.0.0",
          }
        `);
      });

      it('should bump projects if their dependencies have resolved specifiers, even when they have not resolved their own specifiers, when updateDependents is set to its default of "auto" - TRANSITIVE DEPENDENCY MANY LEVELS AWAY', async () => {
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
            - projectJ@1.0.0 [js]
              -> depends on projectK {devDependencies}
            - projectK@2.0.0 [js]
              -> depends on projectL {optionalDependencies}
            - projectL@3.0.0 [js]
              -> depends on projectM {dependencies}
            - projectM@4.0.0 [js]
              -> depends on projectN {peerDependencies}
            - projectN@5.0.0 [js]
              -> depends on projectO {dependencies}
            - projectO@6.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

        processor = new ReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          releaseGroups,
          releaseGroupToFilteredProjects,
          {
            dryRun: false,
            verbose: false,
            firstRelease: false,
            preid: undefined,
            filters,
          }
        );
        await processor.init();

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // only projectO has a specifier, all other projects have no specifier but should be bumped as a cascading side effect
            if (projectName === 'projectO') return 'major';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(6);

        // projectJ is bumped because of its dependency on projectK
        expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
          {
            "devDependencies": {
              "projectK": "2.0.1",
            },
            "name": "projectJ",
            "version": "1.0.1",
          }
        `);
        // projectK is bumped because of its dependency on projectL
        expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectK",
            "optionalDependencies": {
              "projectL": "3.0.1",
            },
            "version": "2.0.1",
          }
        `);
        // projectL is bumped because of its dependency on projectM
        expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectM": "4.0.1",
            },
            "name": "projectL",
            "version": "3.0.1",
          }
        `);
        // projectM is bumped because of its dependency on projectN
        expect(readJson(tree, 'projectM/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectM",
            "peerDependencies": {
              "projectN": "5.0.1",
            },
            "version": "4.0.1",
          }
        `);
        // projectN is bumped because of its dependency on projectO
        expect(readJson(tree, 'projectN/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectO": "7.0.0",
            },
            "name": "projectN",
            "version": "5.0.1",
          }
        `);
        // projectO is bumped because of its own specifier of major
        expect(readJson(tree, 'projectO/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectO",
            "version": "7.0.0",
          }
        `);
      });

      it('should bump projects by the maximum of their own specifier and the updateDependents bump but not both, when updateDependents is set to its default of "auto"', async () => {
        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // projectL has a specifier, this will cause projectK and projectJ to need to be bumped.
            if (projectName === 'projectL') return 'major';
            // projectK has its own specifier which is higher than the default updateDependents bump of "patch", so this is what should be applied
            if (projectName === 'projectK') return 'minor';
            // projectJ also has its own specifier which is higher than the default updateDependents bump of "patch", so this is what should be applied
            if (projectName === 'projectJ') return 'major';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(3);

        // projectJ is bumped based on its own specifier of major, the patch bump from updateDependents is not applied on top
        expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectK": "2.1.0",
            },
            "name": "projectJ",
            "version": "2.0.0",
          }
        `);
        // projectK is bumped based on its own specifier of minor, the patch bump from updateDependents is not applied on top
        expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectL": "4.0.0",
            },
            "name": "projectK",
            "version": "2.1.0",
          }
        `);
        // projectL gets a major bump via its own specifier
        expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectL",
            "version": "4.0.0",
          }
        `);
      });

      it('should not bump dependents if their dependencies have resolved specifiers, if updateDependents is set to "never" - SINGLE LEVEL DEPENDENCY', async () => {
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
            - projectJ@1.0.0 [js]
              -> depends on projectK
            - projectK@2.0.0 [js]
              -> depends on projectL
            - projectL@3.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              updateDependents: 'never',
            },
          },
          mockResolveCurrentVersion
        );

        processor = new ReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          releaseGroups,
          releaseGroupToFilteredProjects,
          {
            dryRun: false,
            verbose: false,
            firstRelease: false,
            preid: undefined,
            filters,
          }
        );
        await processor.init();

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // Only projectK has a specifier. This should cause only itself to be bumped and not projectJ, because updateDependents is set to "never"
            if (projectName === 'projectK') return 'minor';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(3);

        // projectJ is not bumped because updateDependents is set to "never", and the dependency on projectK is therefore also not updated
        expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectK": "2.0.0",
            },
            "name": "projectJ",
            "version": "1.0.0",
          }
        `);
        // projectK is bumped based on its own specifier of minor
        expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectL": "3.0.0",
            },
            "name": "projectK",
            "version": "2.1.0",
          }
        `);
        // projectL is not bumped
        expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectL",
            "version": "3.0.0",
          }
        `);
      });

      it('should not bump dependents if their dependencies have resolved specifiers, if updateDependents is set to "never" - TRANSITIVE DEPENDENCY', async () => {
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
            - projectJ@1.0.0 [js]
              -> depends on projectK
            - projectK@2.0.0 [js]
              -> depends on projectL
            - projectL@3.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              updateDependents: 'never',
            },
          },
          mockResolveCurrentVersion
        );

        processor = new ReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          releaseGroups,
          releaseGroupToFilteredProjects,
          {
            dryRun: false,
            verbose: false,
            firstRelease: false,
            preid: undefined,
            filters,
          }
        );
        await processor.init();

        // This time bump projectL which would otherwise cause a cascade of bumps across projectK and projectJ, but should not here because updateDependents is set to "never"
        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // Only projectL has a specifier
            if (projectName === 'projectL') return 'major';
            return 'none';
          }
        );
        await processor.processGroups();

        // Called for each project
        expect(
          mockDeriveSpecifierFromConventionalCommits
        ).toHaveBeenCalledTimes(3);

        // projectJ is not bumped because updateDependents is set to "never"
        expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectK": "2.0.0",
            },
            "name": "projectJ",
            "version": "1.0.0",
          }
        `);
        // projectK is not bumped because updateDependents is set to "never", and the dependency on projectL is therefore also not updated
        expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
          {
            "dependencies": {
              "projectL": "3.0.0",
            },
            "name": "projectK",
            "version": "2.0.0",
          }
        `);
        // projectL is bumped by a major
        expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
          {
            "name": "projectL",
            "version": "4.0.0",
          }
        `);
      });
    });
  });

  /**
   * NOTE: Fundamental issues with filters, like trying to filter to a single project within a fixed release group,
   * will have already been caught and handled by filterReleaseGroups(), so that is not repeated here.
   */
  describe('filters', () => {
    it('should filter out projects with no dependency relationships within a single independent release group based on the provided user filter', async () => {
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
              - projectJ@1.0.0 [js]
              - projectK@2.0.0 [js]
              - projectL@3.0.0 [js]
          `,
        {
          version: {
            conventionalCommits: true,
          },
        },
        mockResolveCurrentVersion,
        {
          // Apply the projects filter to only include projectJ in versioning
          projects: ['projectJ'],
        }
      );

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
          preid: undefined,
          filters,
        }
      );
      await processor.init();

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        () => 'minor'
      );
      await processor.processGroups();

      // The mock should only be called once, for the filtered projectJ
      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        1
      );

      // Only projectJ should be bumped
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectJ",
          "version": "1.1.0",
        }
      `);
      // projectK should not be bumped
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
      // projectL should not be bumped
      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.0.0",
        }
      `);
    });

    it('should filter out projects when applying a user provided projects filter to independent projects which do have dependency relationships within a single independent release group, but which have no dependents', async () => {
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
              - projectJ@1.0.0 [js]
                -> depends on projectK
              - projectK@2.0.0 [js]
                -> depends on projectL
              - projectL@3.0.0 [js]
          `,
        {
          version: {
            conventionalCommits: true,
          },
        },
        mockResolveCurrentVersion,
        {
          // Apply the projects filter to only include projectJ in versioning.
          // projectJ does not have any DEPENDENTS, so it is safe to filter everything else out.
          projects: ['projectJ'],
        }
      );

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
          preid: undefined,
          filters,
        }
      );
      await processor.init();

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        () => 'minor'
      );
      await processor.processGroups();

      // The mock should only be called once, for the filtered projectJ
      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        1
      );

      // Only projectJ should be bumped
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "2.0.0",
          },
          "name": "projectJ",
          "version": "1.1.0",
        }
      `);
      // projectK should not be bumped
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectL": "3.0.0",
          },
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
      // projectL should not be bumped
      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.0.0",
        }
      `);
    });

    it('should filter out projects when applying a user provided projects filter to independent projects which do have dependency relationships within a single independent release group, and which have dependents, as long as updateDependents is set to "never"', async () => {
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
              - projectJ@1.0.0 [js]
                -> depends on projectK
              - projectK@2.0.0 [js]
                -> depends on projectL
              - projectL@3.0.0 [js]
          `,
        {
          version: {
            conventionalCommits: true,
            updateDependents: 'never',
          },
        },
        mockResolveCurrentVersion,
        {
          // Apply the projects filter to only include projectL in versioning.
          projects: ['projectL'],
        }
      );

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
          preid: undefined,
          filters,
        }
      );
      await processor.init();

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        () => 'minor'
      );
      await processor.processGroups();

      // The mock should only be called once, for the filtered projectL
      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        1
      );
      // projectJ should not be bumped because updateDependents is set to "never"
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "2.0.0",
          },
          "name": "projectJ",
          "version": "1.0.0",
        }
      `);
      // projectK should not be bumped because updateDependents is set to "never"
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectL": "3.0.0",
          },
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
      // Only projectL should be bumped
      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.1.0",
        }
      `);
    });
  });

  describe('non-semver versioning', () => {
    it('should handle non-semver versioning for a simple fixed release group with no dependencies', async () => {
      const {
        nxReleaseConfig,
        projectGraph,
        releaseGroups,
        releaseGroupToFilteredProjects,
        filters,
      } = await createNxReleaseConfigAndPopulateWorkspace(
        tree,
        // projectB also intentionally has no current version
        `
          __default__ ({ "projectsRelationship": "fixed" }):
            - projectA@1.0 [non-semver]
            - projectB [non-semver]
        `,
        {},
        mockResolveCurrentVersion
      );

      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"1.0"`
      );
      // projectB has no version currently
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `""`
      );

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
          preid: undefined,
          filters,
          userGivenSpecifier: '2.0',
        }
      );
      await processor.init();
      await processor.processGroups();

      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2.0"`
      );
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2.0"`
      );
    });

    it('should handle non-semver versioning for a simple independent release group with no dependencies', async () => {
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
            - projectA@abc123 [non-semver]
            - projectB@2099-01-01.build1 [non-semver]
        `,
        {},
        mockResolveCurrentVersion,
        {
          // Update version projectB
          projects: ['projectB'],
        }
      );

      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"abc123"`
      );
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2099-01-01.build1"`
      );

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
          preid: undefined,
          filters,
          userGivenSpecifier: '2099-01-01.build2',
        }
      );
      await processor.init();
      await processor.processGroups();

      // Unchanged
      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"abc123"`
      );
      // New version
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2099-01-01.build2"`
      );
    });

    it('should handle non-semver versioning for a simple independent release group with dependencies', async () => {
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
            - projectA@abc123 [non-semver]
              -> depends on projectB
            - projectB@2099-01-01.build1 [non-semver]
        `,
        {},
        mockResolveCurrentVersion,
        {
          // Update version projectB
          projects: ['projectB'],
        }
      );

      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"abc123"`
      );
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2099-01-01.build1"`
      );

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
          preid: undefined,
          filters,
          userGivenSpecifier: '2099-01-01.build2',
        }
      );
      await processor.init();
      await processor.processGroups();

      // projectA changed its version in some arbitrary way as a side effect of the dependency bump (as dictated by its version actions implementation)
      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"{SOME_NEW_VERSION_DERIVED_AS_A_SIDE_EFFECT_OF_DEPENDENCY_BUMP}"`
      );
      // New version
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2099-01-01.build2"`
      );
    });
  });

  describe('versionData', () => {
    it('should populate versionData even when projects are not versioned', async () => {
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
            - libtest1@4.5.0 [js]
            - my-nest-app@1.0.0 [js]
        `,
        {
          version: {
            conventionalCommits: true,
          },
        },
        mockResolveCurrentVersion
      );

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
          preid: undefined,
          filters,
        }
      );
      await processor.init();

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        () => 'none'
      );
      await processor.processGroups();

      expect(processor.getVersionData()).toMatchInlineSnapshot(`
        {
          "libtest1": {
            "currentVersion": "4.5.0",
            "dependentProjects": [],
            "dockerVersion": null,
            "newVersion": null,
          },
          "my-nest-app": {
            "currentVersion": "1.0.0",
            "dependentProjects": [],
            "dockerVersion": null,
            "newVersion": null,
          },
        }
      `);
    });
  });
});
