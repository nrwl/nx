import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeLibraryGeneratorSimpleModuleNameOption from './remove-library-generator-simple-module-name-option';

describe('removeLibraryGeneratorSimpleModuleNameOption', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('nx.json', () => {
    it('should replace simpleModuleName with simpleName', async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        generators: {
          '@nrwl/angular:library': {
            simpleModuleName: true,
          },
        },
      });

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.generators['@nrwl/angular:library']).toStrictEqual({
        simpleName: true,
      });
    });

    it('should support nested library generator default', async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        generators: {
          '@nrwl/angular': {
            library: {
              simpleModuleName: true,
            },
          },
        },
      });

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.generators['@nrwl/angular']).toStrictEqual({
        library: {
          simpleName: true,
        },
      });
    });

    it('should keep simpleName if defined and remove simpleModuleName', async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        generators: {
          '@nrwl/angular:library': {
            simpleModuleName: true,
            simpleName: false,
          },
        },
      });

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.generators['@nrwl/angular:library']).toStrictEqual({
        simpleName: false,
      });
    });

    it('should do nothing if simpleModuleName is not set', async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        generators: {
          '@nrwl/angular:library': {
            simpleName: true,
          },
        },
      });

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.generators['@nrwl/angular:library']).toStrictEqual({
        simpleName: true,
      });
    });

    it('should not throw when library generator defaults are not set', async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        generators: {
          '@nrwl/angular:component': {
            standalone: true,
          },
        },
      });

      await expect(
        removeLibraryGeneratorSimpleModuleNameOption(tree)
      ).resolves.not.toThrow();

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.generators).toStrictEqual({
        '@nrwl/angular:component': {
          standalone: true,
        },
      });
    });

    it('should not throw when generators defaults are not set', async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, { ...nxJson, generators: undefined });

      await expect(
        removeLibraryGeneratorSimpleModuleNameOption(tree)
      ).resolves.not.toThrow();

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.generators).toBeUndefined();
    });

    it('should not throw when nx.json does not exist', async () => {
      tree.delete('nx.json');

      await expect(
        removeLibraryGeneratorSimpleModuleNameOption(tree)
      ).resolves.not.toThrow();

      expect(tree.exists('nx.json')).toBe(false);
    });
  });

  describe('project configs', () => {
    it('should replace simpleModuleName with simpleName', async () => {
      const project = {
        name: 'project',
        root: '/',
        targets: {},
        generators: {
          '@nrwl/angular:library': {
            simpleModuleName: true,
          },
        },
      };
      addProjectConfiguration(tree, 'project', project);

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedProject = readProjectConfiguration(tree, 'project');
      expect(updatedProject.generators['@nrwl/angular:library']).toStrictEqual({
        simpleName: true,
      });
    });

    it('should support nested library generator default', async () => {
      const project = {
        name: 'project',
        root: '/',
        targets: {},
        generators: {
          '@nrwl/angular': {
            library: {
              simpleModuleName: true,
            },
          },
        },
      };
      addProjectConfiguration(tree, 'project', project);

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedProject = readProjectConfiguration(tree, 'project');
      expect(updatedProject.generators['@nrwl/angular']).toStrictEqual({
        library: {
          simpleName: true,
        },
      });
    });

    it('should keep simpleName if defined and remove simpleModuleName', async () => {
      const project = {
        name: 'project',
        root: '/',
        targets: {},
        generators: {
          '@nrwl/angular:library': {
            simpleModuleName: true,
            simpleName: false,
          },
        },
      };
      addProjectConfiguration(tree, 'project', project);

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedProject = readProjectConfiguration(tree, 'project');
      expect(updatedProject.generators['@nrwl/angular:library']).toStrictEqual({
        simpleName: false,
      });
    });

    it('should do nothing if simpleModuleName is not set', async () => {
      const project = {
        name: 'project',
        root: '/',
        targets: {},
        generators: {
          '@nrwl/angular:library': {
            simpleName: true,
          },
        },
      };
      addProjectConfiguration(tree, 'project', project);

      await removeLibraryGeneratorSimpleModuleNameOption(tree);

      const updatedProject = readProjectConfiguration(tree, 'project');
      expect(updatedProject.generators['@nrwl/angular:library']).toStrictEqual({
        simpleName: true,
      });
    });

    it('should not throw when library generator defaults are not set', async () => {
      const project = {
        name: 'project',
        root: '/',
        targets: {},
        generators: {
          '@nrwl/angular:component': {
            standalone: true,
          },
        },
      };
      addProjectConfiguration(tree, 'project', project);

      await expect(
        removeLibraryGeneratorSimpleModuleNameOption(tree)
      ).resolves.not.toThrow();

      const updatedProject = readProjectConfiguration(tree, 'project');
      expect(updatedProject.generators).toStrictEqual({
        '@nrwl/angular:component': {
          standalone: true,
        },
      });
    });

    it('should not throw when generators defaults are not set', async () => {
      const project = {
        name: 'project',
        root: '/',
        targets: {},
      };
      addProjectConfiguration(tree, 'project', project);

      await expect(
        removeLibraryGeneratorSimpleModuleNameOption(tree)
      ).resolves.not.toThrow();

      const updatedProject = readProjectConfiguration(tree, 'project');
      expect(updatedProject.generators).toBeUndefined();
    });
  });
});
