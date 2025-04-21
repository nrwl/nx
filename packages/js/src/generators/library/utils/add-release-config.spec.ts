import {
  getPackageManagerCommand,
  readJson,
  Tree,
  updateJson,
  output,
  ProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
} from './add-release-config';

const USE_LEGACY_VERSIONING = true;

describe('add release config', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('/.gitignore', '');
  });

  describe('addReleaseConfigForNonTsSolution', () => {
    it('should update the nx-release-publish target to specify dist/{projectRoot} as the package root', async () => {
      const projectConfig: ProjectConfiguration = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );
      expect(projectConfig.targets?.['nx-release-publish']).toEqual({
        options: {
          packageRoot: 'dist/{projectRoot}',
        },
      });
    });

    it('should not change preVersionCommand if it already exists', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          version: {
            preVersionCommand: 'echo "hello world"',
          },
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        version: {
          preVersionCommand: 'echo "hello world"',
        },
      });
    });

    it('should not add projects if no release config exists', async () => {
      updateJson(tree, 'nx.json', (json) => {
        delete json.release;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should not add projects if release config exists but doesn't specify groups or projects", async () => {
      const existingReleaseConfig = {
        version: {
          git: {},
        },
        changelog: {
          projectChangelogs: true,
        },
      };
      updateJson(tree, 'nx.json', (json) => {
        json.release = existingReleaseConfig;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        ...existingReleaseConfig,
        version: {
          ...existingReleaseConfig.version,
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists as a string and matches the new project', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: '*',
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: '*',
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists as an array and matches the new project by name', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['something-else', 'my-lib'],
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['something-else', 'my-lib'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists and matches the new project by tag', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['tag:one'],
        };
        return json;
      });

      const projectConfig: ProjectConfiguration = {
        root: 'libs/my-lib',
        tags: ['one', 'two'],
      };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['tag:one'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists and matches the new project by root directory', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['packages/*'],
        };
        return json;
      });

      const projectConfig = { root: 'packages/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['packages/*'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should append project to projects if projects exists as an array, but doesn't already match the new project", async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['something-else'],
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['something-else', 'my-lib'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should convert projects to an array and append the new project to it if projects exists as a string, but doesn't already match the new project", async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: 'packages',
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['packages', 'my-lib'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists as groups config and matches the new project', async () => {
      const existingReleaseConfig = {
        groups: {
          group1: {
            projects: ['something-else'],
          },
          group2: {
            projects: ['my-lib'],
          },
        },
      };
      updateJson(tree, 'nx.json', (json) => {
        json.release = existingReleaseConfig;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        groups: existingReleaseConfig.groups,
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should warn the user if their defined groups don't match the new project", async () => {
      const outputSpy = jest
        .spyOn(output, 'warn')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      const existingReleaseConfig = {
        groups: {
          group1: {
            projects: ['something-else'],
          },
          group2: {
            projects: ['other-thing'],
          },
        },
      };
      updateJson(tree, 'nx.json', (json) => {
        json.release = existingReleaseConfig;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForNonTsSolution(
        USE_LEGACY_VERSIONING,
        tree,
        'my-lib',
        projectConfig
      );

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        groups: existingReleaseConfig.groups,
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
      expect(outputSpy).toHaveBeenCalledWith({
        title: `Could not find a release group that includes my-lib`,
        bodyLines: [
          `Ensure that my-lib is included in a release group's "projects" list in nx.json so it can be published with "nx release"`,
        ],
      });

      outputSpy.mockRestore();
    });
  });

  describe('addReleaseConfigForTsSolution', () => {
    it('should not update set nx-release-publish target', async () => {
      const projectConfig: ProjectConfiguration = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);
      expect(projectConfig.targets?.['nx-release-publish']).toBeUndefined();
    });

    it('should not change preVersionCommand if it already exists', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          version: {
            preVersionCommand: 'echo "hello world"',
          },
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        version: {
          preVersionCommand: 'echo "hello world"',
        },
      });
    });

    it('should not add projects if no release config exists', async () => {
      updateJson(tree, 'nx.json', (json) => {
        delete json.release;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should not add projects if release config exists but doesn't specify groups or projects", async () => {
      const existingReleaseConfig = {
        version: {
          git: {},
        },
        changelog: {
          projectChangelogs: true,
        },
      };
      updateJson(tree, 'nx.json', (json) => {
        json.release = existingReleaseConfig;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        ...existingReleaseConfig,
        version: {
          ...existingReleaseConfig.version,
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists as a string and matches the new project', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: '*',
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: '*',
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists as an array and matches the new project by name', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['something-else', 'my-lib'],
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['something-else', 'my-lib'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists and matches the new project by tag', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['tag:one'],
        };
        return json;
      });

      const projectConfig: ProjectConfiguration = {
        root: 'libs/my-lib',
        tags: ['one', 'two'],
      };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['tag:one'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists and matches the new project by root directory', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['packages/*'],
        };
        return json;
      });

      const projectConfig = { root: 'packages/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['packages/*'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should append project to projects if projects exists as an array, but doesn't already match the new project", async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: ['something-else'],
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['something-else', 'my-lib'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should convert projects to an array and append the new project to it if projects exists as a string, but doesn't already match the new project", async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.release = {
          projects: 'packages',
        };
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        projects: ['packages', 'my-lib'],
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it('should not change projects if it already exists as groups config and matches the new project', async () => {
      const existingReleaseConfig = {
        groups: {
          group1: {
            projects: ['something-else'],
          },
          group2: {
            projects: ['my-lib'],
          },
        },
      };
      updateJson(tree, 'nx.json', (json) => {
        json.release = existingReleaseConfig;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        groups: existingReleaseConfig.groups,
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
    });

    it("should warn the user if their defined groups don't match the new project", async () => {
      const outputSpy = jest
        .spyOn(output, 'warn')
        .mockImplementationOnce(() => {
          return undefined as never;
        });

      const existingReleaseConfig = {
        groups: {
          group1: {
            projects: ['something-else'],
          },
          group2: {
            projects: ['other-thing'],
          },
        },
      };
      updateJson(tree, 'nx.json', (json) => {
        json.release = existingReleaseConfig;
        return json;
      });

      const projectConfig = { root: 'libs/my-lib' };
      await addReleaseConfigForTsSolution(tree, 'my-lib', projectConfig);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        groups: existingReleaseConfig.groups,
        version: {
          preVersionCommand: `${
            getPackageManagerCommand().dlx
          } nx run-many -t build`,
        },
      });
      expect(outputSpy).toHaveBeenCalledWith({
        title: `Could not find a release group that includes my-lib`,
        bodyLines: [
          `Ensure that my-lib is included in a release group's "projects" list in nx.json so it can be published with "nx release"`,
        ],
      });

      outputSpy.mockRestore();
    });
  });
});
