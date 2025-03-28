import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../../generators/tree';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { ProjectLogger } from './project-logger';
import type { FinalConfigForProject } from './release-group-processor';
import { resolveCurrentVersion } from './resolve-current-version';
import { VersionActions } from './version-actions';

// TODO: Add unit test coverage for the other currentVersionResolver options
describe('resolveCurrentVersion', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('disk', () => {
    const finalConfigForProject: FinalConfigForProject = {
      specifierSource: 'prompt',
      currentVersionResolver: 'disk',
      currentVersionResolverMetadata: {},
      fallbackCurrentVersionResolver: 'disk',
      versionPrefix: 'auto',
      preserveLocalDependencyProtocols: true,
      manifestRootsToUpdate: [],
      versionActionsOptions: {},
    };

    class TestVersionActions extends VersionActions {
      validManifestFilenames = ['package.json'];

      async readCurrentVersionFromSourceManifest() {
        return {
          currentVersion: '1.2.3',
          manifestPath: 'package.json',
        };
      }
      async readCurrentVersionFromRegistry() {
        return {
          currentVersion: '1.2.3',
          logText: 'https://example.com/fake-registry',
        };
      }
      async updateProjectVersion() {
        return [];
      }
      async readCurrentVersionOfDependency() {
        return {
          currentVersion: '1.2.3',
          dependencyCollection: 'dependencies',
        };
      }
      async isLocalDependencyProtocol() {
        return false;
      }
      async updateProjectDependencies() {
        return [];
      }
    }

    class TestProjectLogger extends ProjectLogger {
      constructor(projectName: string) {
        super(projectName);
      }
      override buffer(message: string) {}
    }

    it('should resolve the current version from disk based on the provided versionActions instance, when currentVersionResolver is set to disk on the releaseGroup and nothing is set on the project node', async () => {
      const projectGraphNode: ProjectGraphProjectNode = {
        name: 'test',
        type: 'lib' as const,
        data: {
          root: tree.root,
        },
        // No release config, should use the releaseGroup config
      };
      const releaseGroup = {
        name: 'release-group',
        version: {
          currentVersionResolver: 'disk',
        },
      } as unknown as ReleaseGroupWithName;

      const currentVersion = await resolveCurrentVersion(
        tree,
        projectGraphNode,
        releaseGroup,
        new TestVersionActions(
          releaseGroup,
          projectGraphNode,
          finalConfigForProject
        ),
        new TestProjectLogger(projectGraphNode.name),
        new Map(),
        finalConfigForProject,
        undefined
      );
      expect(currentVersion).toBe('1.2.3');
    });

    it('should resolve the current version from disk based on the provided versionActions instance, when currentVersionResolver is set to disk on the project node, regardless of what is set on the releaseGroup', async () => {
      const projectGraphNode: ProjectGraphProjectNode = {
        name: 'test',
        type: 'lib' as const,
        data: {
          root: tree.root,
          release: {
            version: {
              currentVersionResolver: 'disk',
            },
          },
        },
      };
      const releaseGroup = {
        name: 'release-group',
        version: {
          // Should be ignored in favor of the project node
          currentVersionResolver: 'SOMETHING_ELSE',
        },
      } as unknown as ReleaseGroupWithName;

      const currentVersion = await resolveCurrentVersion(
        tree,
        projectGraphNode,
        releaseGroup,
        new TestVersionActions(
          releaseGroup,
          projectGraphNode,
          finalConfigForProject
        ),
        new TestProjectLogger(projectGraphNode.name),
        new Map(),
        finalConfigForProject,
        undefined
      );
      expect(currentVersion).toBe('1.2.3');
    });

    it('should throw an error if the currentVersionResolver is set to disk but the configured versionActions does not support a manifest file', async () => {
      const projectGraphNode: ProjectGraphProjectNode = {
        name: 'test',
        type: 'lib' as const,
        data: {
          root: tree.root,
          release: {
            version: {
              currentVersionResolver: 'disk',
            },
          },
        },
      };
      const releaseGroup = {
        name: 'release-group',
      } as unknown as ReleaseGroupWithName;

      class TestVersionActionsWithoutManifest extends VersionActions {
        validManifestFilenames = null;

        async readCurrentVersionFromSourceManifest() {
          return null;
        }
        async readCurrentVersionFromRegistry() {
          return {
            currentVersion: '1.2.3',
            logText: 'https://example.com/fake-registry',
          };
        }
        async updateProjectVersion() {
          return [];
        }
        async readCurrentVersionOfDependency() {
          return {
            currentVersion: '1.2.3',
            dependencyCollection: 'dependencies',
          };
        }
        async isLocalDependencyProtocol() {
          return false;
        }
        async updateProjectDependencies() {
          return [];
        }
      }

      await expect(
        resolveCurrentVersion(
          tree,
          projectGraphNode,
          releaseGroup,
          new TestVersionActionsWithoutManifest(
            releaseGroup,
            projectGraphNode,
            finalConfigForProject
          ),
          new TestProjectLogger(projectGraphNode.name),
          new Map(),
          finalConfigForProject,
          undefined
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"For project "test", the "currentVersionResolver" is set to "disk" but it is using "versionActions" of type "TestVersionActionsWithoutManifest". This is invalid because "TestVersionActionsWithoutManifest" does not support a manifest file. You should use a different "currentVersionResolver" or use a different "versionActions" implementation that supports a manifest file"`
      );
    });
  });
});
