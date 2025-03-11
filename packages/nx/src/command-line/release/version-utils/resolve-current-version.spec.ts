import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { createTreeWithEmptyWorkspace } from '../../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../../generators/tree';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { ManifestActions } from './flexible-version-management';
import { ProjectLogger } from './project-logger';
import { resolveCurrentVersion } from './resolve-current-version';

// TODO: Add unit test coverage for the other currentVersionResolver options
describe('resolveCurrentVersion', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('disk', () => {
    class TestManifestActions extends ManifestActions {
      manifestFilename = 'package.json';

      async readCurrentVersionFromSourceManifest() {
        return '1.2.3';
      }
      async readCurrentVersionFromRegistry() {
        return {
          currentVersion: '1.2.3',
          logText: 'https://example.com/fake-registry',
        };
      }
      async ensureSourceManifestExistsAtExpectedLocation() {
        return;
      }
      async readSourceManifestData() {
        return {
          name: 'test',
          currentVersion: '1.2.3',
          dependencies: {},
        };
      }
      async writeVersionToManifests() {
        return;
      }
      async getCurrentVersionOfDependency() {
        return {
          currentVersion: '1.2.3',
          dependencyCollection: 'dependencies',
        };
      }
      async updateDependencies() {
        return;
      }
    }

    class TestProjectLogger extends ProjectLogger {
      constructor(projectName: string) {
        super(projectName);
      }
      override buffer(message: string) {}
    }

    it('should resolve the current version from disk based on the provided manifestAction instance, when currentVersionResolver is set to disk on the releaseGroup and nothing is set on the project node', async () => {
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
          generatorOptions: {
            currentVersionResolver: 'disk',
          },
        },
      } as unknown as ReleaseGroupWithName;

      const currentVersion = await resolveCurrentVersion(
        tree,
        projectGraphNode,
        releaseGroup,
        new TestManifestActions(releaseGroup, projectGraphNode, []),
        new TestProjectLogger(projectGraphNode.name),
        false,
        new Map(),
        undefined,
        undefined
      );
      expect(currentVersion).toBe('1.2.3');
    });

    it('should resolve the current version from disk based on the provided manifestAction instance, when currentVersionResolver is set to disk on the project node, regardless of what is set on the releaseGroup', async () => {
      const projectGraphNode: ProjectGraphProjectNode = {
        name: 'test',
        type: 'lib' as const,
        data: {
          root: tree.root,
          release: {
            version: {
              generatorOptions: {
                currentVersionResolver: 'disk',
              },
            },
          },
        },
      };
      const releaseGroup = {
        name: 'release-group',
        version: {
          generatorOptions: {
            // Should be ignored in favor of the project node
            currentVersionResolver: 'SOMETHING_ELSE',
          },
        },
      } as unknown as ReleaseGroupWithName;

      const currentVersion = await resolveCurrentVersion(
        tree,
        projectGraphNode,
        releaseGroup,
        new TestManifestActions(releaseGroup, projectGraphNode, []),
        new TestProjectLogger(projectGraphNode.name),
        false,
        new Map(),
        undefined,
        undefined
      );
      expect(currentVersion).toBe('1.2.3');
    });
  });
});
