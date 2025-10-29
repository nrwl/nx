let mockDeriveSpecifierFromConventionalCommits = jest.fn();
let mockDeriveSpecifierFromVersionPlan = jest.fn();
let mockResolveVersionActionsForProject = jest.fn();

jest.doMock('./derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits:
    mockDeriveSpecifierFromConventionalCommits,
}));

// Use jest.mock (hoisted) to ensure it's set up before any imports
jest.mock('./version-actions', () => ({
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
  createTestReleaseGroupProcessor,
  mockResolveVersionActionsForProjectImplementation,
} from './test-utils';

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

    const processor = await createTestReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      filters
    );

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
    const { nxReleaseConfig, projectGraph, filters } =
      await createNxReleaseConfigAndPopulateWorkspace(
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

    const processor = await createTestReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      filters
    );

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
    const { nxReleaseConfig, projectGraph, filters } =
      await createNxReleaseConfigAndPopulateWorkspace(
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

    const processor = await createTestReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      filters
    );

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
    const { nxReleaseConfig, projectGraph, filters } =
      await createNxReleaseConfigAndPopulateWorkspace(
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

    const processor = await createTestReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      filters
    );

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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
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

    it('should only bump projects based on their own specifiers if no dependencies have resolved specifiers and file:// ref is used and preserveLocalDependencyProtocols is false', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent" }):
            - projectJ@1.0.0 [js]
              -> depends on projectK(file://../projectK)
            - projectK@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              preserveLocalDependencyProtocols: false,
            },
          },
          mockResolveCurrentVersion
        );

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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
        2
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
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
    });

    it('should only bump projects based on their own specifiers if no dependencies have resolved specifiers and file:// ref is used and preserveLocalDependencyProtocols is true', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent" }):
            - projectJ@1.0.0 [js]
              -> depends on projectK(file://../projectK)
            - projectK@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              preserveLocalDependencyProtocols: true,
            },
          },
          mockResolveCurrentVersion
        );

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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
        2
      );

      // Only projectJ is bumped
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "file://../projectK",
          },
          "name": "projectJ",
          "version": "1.1.0",
        }
      `);
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectK",
          "version": "2.0.0",
        }
      `);
    });

    it('should bump dependents when their dependencies have been bumped and they are linked via file:// ref and preserveLocalDependencyProtocols is false', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent" }):
            - projectJ@1.0.0 [js]
              -> depends on projectK(file://../projectK)
            - projectK@2.0.0 [js]
              -> depends on projectL(file://../projectL)
            - projectL@3.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              preserveLocalDependencyProtocols: false,
            },
          },
          mockResolveCurrentVersion
        );

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // Only projectJ has a specifier, it is not depended on by anything else
          if (projectName === 'projectJ') return 'patch';
          if (projectName === 'projectL') return 'patch';
          return 'none';
        }
      );
      await processor.processGroups();

      // Called for each project
      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        3
      );

      // projectL is patch bumped
      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.0.1",
        }
      `);
      // projectK is patch bumped, and its dependency on projectL is bumped
      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectL": "3.0.1",
          },
          "name": "projectK",
          "version": "2.0.1",
        }
      `);
      // projectJ has its dep on projectK updated to projectK's new patch bumped version as a result of its dependency on projectL updating and projectJ's own version is patch bumped
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "2.0.1",
          },
          "name": "projectJ",
          "version": "1.0.1",
        }
      `);
    });

    it('should handle projects with mixed dependency types', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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

        const processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );

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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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

        const processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );

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
      it('should bump projects if their dependencies have resolved specifiers, even when they have not resolved their own specifiers, when updateDependents is set to its default of "always" - SINGLE LEVEL DEPENDENCY', async () => {
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

      it('should bump projects if their dependencies have resolved specifiers, even when they have not resolved their own specifiers, when updateDependents is set to its default of "always" - TRANSITIVE DEPENDENCY', async () => {
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

      it('should bump projects if their dependencies have resolved specifiers, even when they have not resolved their own specifiers, when updateDependents is set to its default of "always" - TRANSITIVE DEPENDENCY MANY LEVELS AWAY', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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

        processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );

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

      it('should bump projects by the maximum of their own specifier and the updateDependents bump but not both, when updateDependents is set to its default of "always"', async () => {
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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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

        processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );

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
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
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

        processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );

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

    it('should bump projects within same group when updateDependents is explicitly set to "auto"', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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
              updateDependents: 'auto', // Explicitly set to 'auto'
            },
          },
          mockResolveCurrentVersion
        );

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          if (projectName === 'projectK') return 'minor';
          return 'none';
        }
      );
      await processor.processGroups();

      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        3
      );

      // projectJ is bumped because updateDependents is 'auto' and both are in same group
      expect(readJson(tree, 'projectJ/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectK": "2.1.0",
          },
          "name": "projectJ",
          "version": "1.0.1",
        }
      `);

      expect(readJson(tree, 'projectK/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectL": "3.0.0",
          },
          "name": "projectK",
          "version": "2.1.0",
        }
      `);

      expect(readJson(tree, 'projectL/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectL",
          "version": "3.0.0",
        }
      `);
    });

    it('should NOT bump projects across different release groups when updateDependents is set to "auto" and a filter is applied', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          group1 ({ "projectsRelationship": "independent" }):
            - projectA@1.0.0 [js]
              -> depends on projectB
          group2 ({ "projectsRelationship": "independent" }):
            - projectB@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              updateDependents: 'auto', // 'auto' respects group boundaries when filtering
            },
          },
          mockResolveCurrentVersion,
          {
            projects: ['projectB'], // Only release projectB in group2
          }
        );

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // Only projectB in group2 has changes
          if (projectName === 'projectB') return 'minor';
          return 'none';
        }
      );
      await processor.processGroups();

      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        1
      );

      // projectA in group1 is NOT bumped because updateDependents is 'auto' and projectA is not in the filtered group
      expect(readJson(tree, 'projectA/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectB": "2.0.0",
          },
          "name": "projectA",
          "version": "1.0.0",
        }
      `);

      // projectB in group2 is bumped based on its own specifier
      expect(readJson(tree, 'projectB/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectB",
          "version": "2.1.0",
        }
      `);
    });

    it('should bump projects across different release groups when updateDependents is explicitly set to "always"', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          group1 ({ "projectsRelationship": "independent" }):
            - projectA@1.0.0 [js]
              -> depends on projectB
          group2 ({ "projectsRelationship": "independent" }):
            - projectB@2.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
              updateDependents: 'always', // Explicitly set to 'always' to propagate across groups
            },
          },
          mockResolveCurrentVersion
        );

      processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // Only projectB in group2 has changes
          if (projectName === 'projectB') return 'minor';
          return 'none';
        }
      );
      await processor.processGroups();

      expect(mockDeriveSpecifierFromConventionalCommits).toHaveBeenCalledTimes(
        2
      );

      // projectA in group1 is bumped because updateDependents is 'always' (propagates across groups)
      expect(readJson(tree, 'projectA/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "projectB": "2.1.0",
          },
          "name": "projectA",
          "version": "1.0.1",
        }
      `);

      // projectB in group2 is bumped based on its own specifier
      expect(readJson(tree, 'projectB/package.json')).toMatchInlineSnapshot(`
        {
          "name": "projectB",
          "version": "2.1.0",
        }
      `);
    });
  });

  /**
   * NOTE: Fundamental issues with filters, like trying to filter to a single project within a fixed release group,
   * will have already been caught and handled by the release graph construction, so that is not repeated here.
   */
  describe('filters', () => {
    it('should filter out projects with no dependency relationships within a single independent release group based on the provided user filter', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        {
          userGivenSpecifier: '2.0',
        }
      );
      await processor.processGroups();

      expect(tree.read('projectA/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2.0"`
      );
      expect(tree.read('projectB/version.txt', 'utf-8')).toMatchInlineSnapshot(
        `"2.0"`
      );
    });

    it('should handle non-semver versioning for a simple independent release group with no dependencies', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        {
          userGivenSpecifier: '2099-01-01.build2',
        }
      );
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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters,
        {
          userGivenSpecifier: '2099-01-01.build2',
        }
      );
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
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
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

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

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

  describe('docker project filtering', () => {
    beforeEach(() => {
      // Set dry-run mode to avoid actual docker command execution in tests
      process.env.NX_DRY_RUN = 'true';
    });

    afterEach(() => {
      // Clean up dry-run mode
      delete process.env.NX_DRY_RUN;
    });

    it('should only process projects with docker targets when group has docker config', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent", "docker": { "preVersionCommand": "npx nx run-many -t docker:build", "versionSchemes": { "production": "{currentDate|YYMM.DD}.{shortCommitSha}" } } }):
            - api@1.0.0 [js] ({ "targets": { "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
            - web-app@1.0.0 [js] ({ "targets": { "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
            - shared-lib@1.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      // Check that only docker projects got dockerOptions
      const apiConfig =
        processor['releaseGraph'].finalConfigsByProject.get('api');
      const webAppConfig =
        processor['releaseGraph'].finalConfigsByProject.get('web-app');
      const sharedLibConfig =
        processor['releaseGraph'].finalConfigsByProject.get('shared-lib');

      // api and web-app should have docker options
      expect(apiConfig).toBeDefined();
      expect(webAppConfig).toBeDefined();
      expect(Object.keys(apiConfig!.dockerOptions).length).toBeGreaterThan(0);
      expect(Object.keys(webAppConfig!.dockerOptions).length).toBeGreaterThan(
        0
      );

      // shared-lib should NOT have docker options (empty object)
      expect(sharedLibConfig).toBeDefined();
      expect(Object.keys(sharedLibConfig!.dockerOptions).length).toBe(0);
    });

    it('should not apply docker options to projects without docker targets', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent", "docker": { "preVersionCommand": "npx nx run-many -t docker:build", "skipVersionActions": ["docker-app"] } }):
            - docker-app@1.0.0 [js] ({ "targets": { "docker:build": { "executor": "@nx/docker:build" }, "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
            - npm-package@1.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      // Check finalConfigsByProject to ensure npm-package doesn't have docker options
      const dockerAppConfig =
        processor['releaseGraph'].finalConfigsByProject.get('docker-app');
      const npmPackageConfig =
        processor['releaseGraph'].finalConfigsByProject.get('npm-package');

      // docker-app should have docker options
      expect(dockerAppConfig).toBeDefined();
      expect(
        Object.keys(dockerAppConfig!.dockerOptions).length
      ).toBeGreaterThan(0);

      // npm-package should NOT have docker options (empty object)
      expect(npmPackageConfig).toBeDefined();
      expect(Object.keys(npmPackageConfig!.dockerOptions).length).toBe(0);
    });

    it('should handle mixed release group with npm and docker projects correctly', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          backend-apps ({ "projectsRelationship": "fixed", "docker": { "preVersionCommand": "npx nx affected -t docker:build", "versionSchemes": { "production": "{currentDate|YYMM.DD}.{shortCommitSha}" } } }):
            - api-gateway@1.0.0 [js] ({ "targets": { "docker:build": { "executor": "@nx/docker:build" }, "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
            - auth-service@1.0.0 [js] ({ "targets": { "docker:build": { "executor": "@nx/docker:build" }, "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
            - shared-utils@1.0.0 [js]
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      // Verify that only docker projects got dockerOptions
      const apiGatewayConfig =
        processor['releaseGraph'].finalConfigsByProject.get('api-gateway');
      const authServiceConfig =
        processor['releaseGraph'].finalConfigsByProject.get('auth-service');
      const sharedUtilsConfig =
        processor['releaseGraph'].finalConfigsByProject.get('shared-utils');

      expect(apiGatewayConfig).toBeDefined();
      expect(authServiceConfig).toBeDefined();
      expect(sharedUtilsConfig).toBeDefined();

      // Docker projects should have docker options
      expect(
        Object.keys(apiGatewayConfig!.dockerOptions).length
      ).toBeGreaterThan(0);
      expect(
        Object.keys(authServiceConfig!.dockerOptions).length
      ).toBeGreaterThan(0);

      // shared-utils should NOT have docker options (empty object)
      expect(Object.keys(sharedUtilsConfig!.dockerOptions).length).toBe(0);
    });

    it('should skip docker projects that have no new version (no changes)', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
          __default__ ({ "projectsRelationship": "independent", "docker": { "preVersionCommand": "npx nx run-many -t docker:build", "versionSchemes": { "production": "{currentDate|YYMM.DD}.{shortCommitSha}" } } }):
            - app-with-changes@1.0.0 [js] ({ "targets": { "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
            - app-no-changes@1.0.0 [js] ({ "targets": { "nx-release-publish": { "executor": "@nx/docker:release-publish" } } })
        `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );

      // Simulate that only app-with-changes has a new version
      // Set up mock BEFORE calling processGroups
      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          if (projectName === 'app-with-changes') {
            return 'patch';
          }
          return 'none'; // app-no-changes has no changes
        }
      );

      await processor.processGroups();

      // Verify that processDockerProjects doesn't throw when a project has no new version
      await processor.processDockerProjects('production', '2024.10.test');

      const versionData = processor.getVersionData();

      // app-with-changes should have both semver and docker version
      expect(versionData['app-with-changes'].newVersion).toBe('1.0.1');
      expect(versionData['app-with-changes'].dockerVersion).toBe(
        '2024.10.test'
      );

      // app-no-changes should have neither (newVersion is null, dockerVersion stays null)
      expect(versionData['app-no-changes'].newVersion).toBeNull();
      expect(versionData['app-no-changes'].dockerVersion).toBeNull();
    });
  });
});
