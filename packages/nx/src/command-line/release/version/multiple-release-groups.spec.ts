// Module-level mock container - initialized early so jest.mock factories can reference it
const mocks = {
  deriveSpecifierFromConventionalCommits: jest.fn(),
  deriveSpecifierFromVersionPlan: jest.fn(),
  resolveVersionActionsForProject: jest.fn(),
  resolveCurrentVersion: jest.fn(),
};

// Aliases for test usage
const mockDeriveSpecifierFromConventionalCommits =
  mocks.deriveSpecifierFromConventionalCommits;
const mockDeriveSpecifierFromVersionPlan = mocks.deriveSpecifierFromVersionPlan;
const mockResolveVersionActionsForProject =
  mocks.resolveVersionActionsForProject;
const mockResolveCurrentVersion = mocks.resolveCurrentVersion;

jest.mock('./derive-specifier-from-conventional-commits', () => ({
  deriveSpecifierFromConventionalCommits: (...args: any[]) =>
    mocks.deriveSpecifierFromConventionalCommits(...args),
}));

jest.mock('./version-actions', () => {
  const actual = jest.requireActual('./version-actions');
  return {
    ...actual,
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
    // Don't slow down or add noise to unit tests output unnecessarily
    ProjectLogger: class ProjectLogger {
      buffer() {}
      flush() {}
    },
  };
});

jest.mock('./resolve-current-version', () => ({
  resolveCurrentVersion: (...args: any[]) =>
    mocks.resolveCurrentVersion(...args),
}));

import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../../generators/tree';
import {
  createNxReleaseConfigAndPopulateWorkspace,
  createTestReleaseGroupProcessor,
  mockResolveVersionActionsForProjectImplementation,
} from './test-utils';

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

describe('Multiple Release Groups', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.resetAllMocks();

    mockResolveVersionActionsForProject.mockImplementation(
      mockResolveVersionActionsForProjectImplementation
    );
  });

  describe('Two unrelated groups, both fixed relationship, just JS', () => {
    it('should correctly version projects using mocked conventional commits', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            group1 ({ "projectsRelationship": "fixed" }):
              - pkg-a@1.0.0 [js]
              - pkg-b@1.0.0 [js]
                -> depends on pkg-a
            group2 ({ "projectsRelationship": "fixed" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.0.0 [js]
                -> depends on pkg-c
          `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // Should cause pkg-a to become 1.1.0 and pkg-b as well because they are in a fixed group. pkg-b dependency on pkg-a should also be updated to 1.1.0
          if (projectName === 'pkg-a') return 'minor';
          if (projectName === 'pkg-b') return 'minor';
          // Should cause pkg-c to become 2.0.1 and pkg-d as well because they are in a fixed group. pkg-d dependency on pkg-c should also be updated to 2.0.1
          if (projectName === 'pkg-c') return 'patch';
          if (projectName === 'pkg-d') return 'patch';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      // Called for each project
      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.1.0"
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.1.0",
          "dependencies": {
            "pkg-a": "1.1.0"
          }
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "2.0.1"
        }
        "
      `);
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.0.1",
          "dependencies": {
            "pkg-c": "2.0.1"
          }
        }
        "
      `);
    });
  });

  describe('Two unrelated groups, both independent relationship, just JS', () => {
    it('should correctly version projects using mocked conventional commits', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            group1 ({ "projectsRelationship": "independent" }):
              - pkg-a@1.0.0 [js]
              - pkg-b@1.1.0 [js]
                -> depends on pkg-a
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.1.0 [js]
                -> depends on pkg-c
          `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          if (projectName === 'pkg-a') return 'minor';
          if (projectName === 'pkg-b') return 'patch';
          if (projectName === 'pkg-c') return 'major';
          if (projectName === 'pkg-d') return 'none';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      // Called for each project
      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.1.0"
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.1.1",
          "dependencies": {
            "pkg-a": "1.1.0"
          }
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "3.0.0"
        }
        "
      `);
      // Patch bump due to dependency update
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.1.1",
          "dependencies": {
            "pkg-c": "3.0.0"
          }
        }
        "
      `);
    });
  });

  describe('Two unrelated groups, one fixed one independent, just JS', () => {
    it('should correctly version projects using mocked conventional commits', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            group1 ({ "projectsRelationship": "fixed" }):
              - pkg-a@1.0.0 [js]
              - pkg-b@1.0.0 [js]
                -> depends on pkg-a
            group2 ({ "projectsRelationship": "independent" }):
              - pkg-c@2.0.0 [js]
              - pkg-d@2.1.0 [js]
                -> depends on pkg-c
          `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          if (projectName === 'pkg-a') return 'minor';
          if (projectName === 'pkg-b') return 'minor';
          if (projectName === 'pkg-c') return 'patch';
          if (projectName === 'pkg-d') return 'minor';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      // Called for each project
      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.1.0"
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.1.0",
          "dependencies": {
            "pkg-a": "1.1.0"
          }
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "2.0.1"
        }
        "
      `);
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.2.0",
          "dependencies": {
            "pkg-c": "2.0.1"
          }
        }
        "
      `);
    });
  });

  describe('Two related groups, both fixed relationship, just JS', () => {
    it('should correctly version projects across group boundaries', async () => {
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

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // pkg-c has a bump, which should cause pkg-d to bump because they are in a fixed group
          // and pkg-a depends on pkg-c so should also bump, and pkg-b is in a fixed group with pkg-a so should also bump
          if (projectName === 'pkg-c') return 'patch';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.0.1",
          "dependencies": {
            "pkg-c": "2.0.1"
          }
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.0.1"
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "2.0.1"
        }
        "
      `);
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.0.1"
        }
        "
      `);
    });
  });

  describe('Three related groups, all fixed relationship, just JS', () => {
    it('should correctly version projects across transitive group boundaries', async () => {
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
                -> depends on pkg-e
              - pkg-d@2.0.0 [js]
            group3 ({ "projectsRelationship": "fixed" }):
              - pkg-e@3.0.0 [js]
              - pkg-f@3.0.0 [js]
          `,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // pkg-e has a bump, which should cause pkg-f to bump because they are in a fixed group
          // pkg-c depends on pkg-e so should also bump, and pkg-d is in a fixed group with pkg-c so should also bump
          // pkg-a depends on pkg-c so should also bump, and pkg-b is in a fixed group with pkg-a so should also bump
          if (projectName === 'pkg-e') return 'patch';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(6);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.0.1",
          "dependencies": {
            "pkg-c": "2.0.1"
          }
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.0.1"
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "2.0.1",
          "dependencies": {
            "pkg-e": "3.0.1"
          }
        }
        "
      `);
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.0.1"
        }
        "
      `);
      expect(tree.read('pkg-e/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-e",
          "version": "3.0.1"
        }
        "
      `);
      expect(tree.read('pkg-f/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-f",
          "version": "3.0.1"
        }
        "
      `);

      const versionData = processor.getVersionData();
      expect(versionData['pkg-a'].newVersion).toEqual('1.0.1');
      expect(versionData['pkg-b'].newVersion).toEqual('1.0.1');
      expect(versionData['pkg-c'].newVersion).toEqual('2.0.1');
      expect(versionData['pkg-d'].newVersion).toEqual('2.0.1');
      expect(versionData['pkg-e'].newVersion).toEqual('3.0.1');
      expect(versionData['pkg-f'].newVersion).toEqual('3.0.1');
    });
  });

  describe('Two related groups, both independent relationship, just JS', () => {
    const graphDefinition = `
      group1 ({ "projectsRelationship": "independent" }):
        - pkg-a@1.0.0 [js]
          -> depends on pkg-c
        - pkg-b@1.1.0 [js]
      group2 ({ "projectsRelationship": "independent" }):
        - pkg-c@2.0.0 [js]
        - pkg-d@2.1.0 [js]
    `;

    it('should correctly version projects across group boundaries', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          graphDefinition,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // pkg-a should still be bumped to 1.0.1 purely because of its dependency on pkg-c from the other group
          if (projectName === 'pkg-a') return 'none';
          // pkg-b should not be bumped because it is in an independent group and has no specifier of its own
          if (projectName === 'pkg-b') return 'none';
          // pkg-c should be bumped to 3.0.0 from its own specifier
          if (projectName === 'pkg-c') return 'major';
          // pkg-d should not be bumped because it is in an independent group and has no specifier of its own
          if (projectName === 'pkg-d') return 'none';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.0.1",
          "dependencies": {
            "pkg-c": "3.0.0"
          }
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.1.0"
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "3.0.0"
        }
        "
      `);
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.1.0"
        }
        "
      `);
    });

    it('should pick an appropriate overall version across group boundaries when a project is influenced by both a direct specifier and a dependency bump', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          graphDefinition,
          {
            version: {
              conventionalCommits: true,
            },
          },
          mockResolveCurrentVersion
        );

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          // pkg-a should be bumped to 1.1.0 because its dependency on pkg-c causing a patch is lower than its own specifier of minor
          if (projectName === 'pkg-a') return 'minor';
          // pkg-b should not be bumped because it is in an independent group and has no specifier of its own
          if (projectName === 'pkg-b') return 'none';
          // pkg-c should be bumped to 3.0.0 from its own specifier
          if (projectName === 'pkg-c') return 'major';
          // pkg-d should not be bumped because it is in an independent group and has no specifier of its own
          if (projectName === 'pkg-d') return 'none';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.1.0",
          "dependencies": {
            "pkg-c": "3.0.0"
          }
        }
        "
      `);
      expect(tree.read('pkg-b/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-b",
          "version": "1.1.0"
        }
        "
      `);
      expect(tree.read('pkg-c/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-c",
          "version": "3.0.0"
        }
        "
      `);
      expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-d",
          "version": "2.1.0"
        }
        "
      `);
    });
  });

  describe('Mixed JS and Rust projects within groups', () => {
    describe('Two unrelated groups, both fixed relationship, mixed JS and Rust', () => {
      it('should correctly version projects using mocked conventional commits', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
              group1 ({ "projectsRelationship": "fixed" }):
                - pkg-a@1.0.0 [js]
                - pkg-b@1.0.0 [rust]
              group2 ({ "projectsRelationship": "fixed" }):
                - pkg-c@2.0.0 [rust]
                - pkg-d@2.0.0 [js]
            `,
            {
              version: {
                conventionalCommits: true,
              },
            },
            mockResolveCurrentVersion
          );

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            if (projectName === 'pkg-a') return 'minor';
            if (projectName === 'pkg-b') return 'minor';
            if (projectName === 'pkg-c') return 'patch';
            if (projectName === 'pkg-d') return 'patch';
            return 'none';
          }
        );

        const processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );
        await processor.processGroups();

        // Called for each project
        expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

        expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "name": "pkg-a",
            "version": "1.1.0"
          }
          "
        `);
        expect(tree.read('pkg-b/Cargo.toml', 'utf-8')).toMatchInlineSnapshot(`
          "
          [package]
          name = 'pkg-b'
          version = '1.1.0'
          "
        `);
        expect(tree.read('pkg-c/Cargo.toml', 'utf-8')).toMatchInlineSnapshot(`
          "
          [package]
          name = 'pkg-c'
          version = '2.0.1'
          "
        `);
        expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "name": "pkg-d",
            "version": "2.0.1"
          }
          "
        `);
      });
    });

    describe('Two unrelated groups, both independent relationship, mixed JS and Rust', () => {
      it('should correctly version projects using mocked conventional commits', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
              group1 ({ "projectsRelationship": "independent" }):
                - pkg-a@1.0.0 [js]
                - pkg-b@1.1.0 [rust]
              group2 ({ "projectsRelationship": "independent" }):
                - pkg-c@2.0.0 [rust]
                - pkg-d@2.1.0 [js]
            `,
            {
              version: {
                conventionalCommits: true,
              },
            },
            mockResolveCurrentVersion
          );

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            if (projectName === 'pkg-a') return 'minor';
            if (projectName === 'pkg-b') return 'patch';
            if (projectName === 'pkg-c') return 'major';
            if (projectName === 'pkg-d') return 'none';
            return 'none';
          }
        );

        const processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );
        await processor.processGroups();

        // Called for each project
        expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

        expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "name": "pkg-a",
            "version": "1.1.0"
          }
          "
        `);
        expect(tree.read('pkg-b/Cargo.toml', 'utf-8')).toMatchInlineSnapshot(`
          "
          [package]
          name = 'pkg-b'
          version = '1.1.1'
          "
        `);
        expect(tree.read('pkg-c/Cargo.toml', 'utf-8')).toMatchInlineSnapshot(`
          "
          [package]
          name = 'pkg-c'
          version = '3.0.0'
          "
        `);
        expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "name": "pkg-d",
            "version": "2.1.0"
          }
          "
        `);
      });
    });

    describe('Two related groups, both fixed relationship, mixed JS and Rust', () => {
      it('should correctly version projects across group boundaries', async () => {
        const { nxReleaseConfig, projectGraph, filters } =
          await createNxReleaseConfigAndPopulateWorkspace(
            tree,
            `
              group1 ({ "projectsRelationship": "fixed" }):
                - pkg-a@1.0.0 [js]
                - pkg-b@1.0.0 [rust]
                  -> depends on pkg-c
              group2 ({ "projectsRelationship": "fixed" }):
                - pkg-c@2.0.0 [rust]
                - pkg-d@2.0.0 [js]
            `,
            {
              version: {
                conventionalCommits: true,
              },
            },
            mockResolveCurrentVersion
          );

        mockDeriveSpecifierFromConventionalCommits.mockImplementation(
          (_, __, ___, ____, { name: projectName }) => {
            // pkg-a should be bumped to 1.0.1 because it is in a fixed group with pkg-b and has no specifier of its own
            if (projectName === 'pkg-a') return 'none';
            // pkg-b should be bumped to 1.0.1 because it depends on pkg-c which is being bumped
            if (projectName === 'pkg-b') return 'none';
            // pkg-c should be bumped to 2.0.1 because of its specifier
            if (projectName === 'pkg-c') return 'patch';
            // pkg-d should be bumped to 2.0.1 because it is in a fixed group with pkg-c and has no specifier of its own
            if (projectName === 'pkg-d') return 'none';
            return 'none';
          }
        );

        const processor = await createTestReleaseGroupProcessor(
          tree,
          projectGraph,
          nxReleaseConfig,
          filters
        );
        await processor.processGroups();

        // Called for each project
        expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(4);

        expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "name": "pkg-a",
            "version": "1.0.1"
          }
          "
        `);
        expect(tree.read('pkg-b/Cargo.toml', 'utf-8')).toMatchInlineSnapshot(`
          "
          [package]
          name = 'pkg-b'
          version = '1.0.1'

          [dependencies]
          pkg-c = '2.0.1'
          "
        `);
        expect(tree.read('pkg-c/Cargo.toml', 'utf-8')).toMatchInlineSnapshot(`
          "
          [package]
          name = 'pkg-c'
          version = '2.0.1'
          "
        `);
        expect(tree.read('pkg-d/package.json', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "name": "pkg-d",
            "version": "2.0.1"
          }
          "
        `);
      });
    });
  });

  describe('groups filter', () => {
    it('should not error if projects in release groups outside of the filtered groups do not have valid manifestsToUpdate', async () => {
      const { nxReleaseConfig, projectGraph, filters } =
        await createNxReleaseConfigAndPopulateWorkspace(
          tree,
          `
            group1 ({ "projectsRelationship": "fixed" }):
              - pkg-a@1.0.0 [js]
            group2 ({ "projectsRelationship": "fixed" }):
              - pkg-c@2.0.0 [js]
          `,
          {
            version: {
              conventionalCommits: true,
              manifestRootsToUpdate: ['{projectRoot}'],
            },
          },
          mockResolveCurrentVersion,
          {
            // Only release group1
            groups: ['group1'],
          }
        );

      // Delete the package.json for pkg-c which is outside of the filtered groups. This test is asserting that this does NOT throw an error.
      tree.delete('pkg-c/package.json');

      mockDeriveSpecifierFromConventionalCommits.mockImplementation(
        (_, __, ___, ____, { name: projectName }) => {
          if (projectName === 'pkg-a') return 'minor';
          return 'none';
        }
      );

      const processor = await createTestReleaseGroupProcessor(
        tree,
        projectGraph,
        nxReleaseConfig,
        filters
      );
      await processor.processGroups();

      // Called for each project
      expect(mockResolveVersionActionsForProject).toHaveBeenCalledTimes(2);

      expect(tree.read('pkg-a/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "pkg-a",
          "version": "1.1.0"
        }
        "
      `);
    });
  });
});
