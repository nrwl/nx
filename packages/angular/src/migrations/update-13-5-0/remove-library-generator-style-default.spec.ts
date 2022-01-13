import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
  WorkspaceConfiguration,
} from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import removeLibraryGeneratorStyleDefault from './remove-library-generator-style-default';

describe('remove-library-generator-style-default migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
    jest.clearAllMocks();
  });

  it('should do nothing when angular library generator is not configured', async () => {
    const workspace: WorkspaceConfiguration = {
      version: 1,
      generators: { '@nrwl/angular:application': { style: 'scss' } },
    };
    updateWorkspaceConfiguration(tree, workspace);

    await removeLibraryGeneratorStyleDefault(tree);

    expect(readWorkspaceConfiguration(tree)).toStrictEqual(workspace);
  });

  it('should do nothing when other vertical library generator is configured with the style entry', async () => {
    const workspace: WorkspaceConfiguration = {
      version: 1,
      generators: { '@nrwl/react:library': { style: 'scss' } },
    };
    updateWorkspaceConfiguration(tree, workspace);

    await removeLibraryGeneratorStyleDefault(tree);

    expect(readWorkspaceConfiguration(tree)).toStrictEqual(workspace);
  });

  describe('collection:generator', () => {
    it('should remove style entry when configured', async () => {
      const workspace: WorkspaceConfiguration = {
        version: 1,
        generators: { '@nrwl/angular:library': { style: 'scss' } },
      };
      updateWorkspaceConfiguration(tree, workspace);

      await removeLibraryGeneratorStyleDefault(tree);

      expect(readWorkspaceConfiguration(tree)).toStrictEqual({
        version: 1,
        generators: { '@nrwl/angular:library': {} },
      });
    });

    it('should do nothing when style is not set', async () => {
      const workspace: WorkspaceConfiguration = {
        version: 1,
        generators: { '@nrwl/angular:library': { linter: 'eslint' } },
      };
      updateWorkspaceConfiguration(tree, workspace);

      await removeLibraryGeneratorStyleDefault(tree);

      expect(readWorkspaceConfiguration(tree)).toStrictEqual(workspace);
    });
  });

  describe('nested generator', () => {
    it('should remove style entry when configured', async () => {
      const workspace: WorkspaceConfiguration = {
        version: 1,
        generators: { '@nrwl/angular': { library: { style: 'scss' } } },
      };
      updateWorkspaceConfiguration(tree, workspace);

      await removeLibraryGeneratorStyleDefault(tree);

      expect(readWorkspaceConfiguration(tree)).toStrictEqual({
        version: 1,
        generators: { '@nrwl/angular': { library: {} } },
      });
    });

    it('should do nothing when style is not set', async () => {
      const workspace: WorkspaceConfiguration = {
        version: 1,
        generators: { '@nrwl/angular': { library: { linter: 'eslint' } } },
      };
      updateWorkspaceConfiguration(tree, workspace);

      await removeLibraryGeneratorStyleDefault(tree);

      expect(readWorkspaceConfiguration(tree)).toStrictEqual(workspace);
    });
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');
    const workspace: WorkspaceConfiguration = {
      version: 1,
      generators: { '@nrwl/angular:library': { style: 'scss' } },
    };
    updateWorkspaceConfiguration(tree, workspace);

    await removeLibraryGeneratorStyleDefault(tree);

    expect(devkit.formatFiles).toHaveBeenCalled();
  });
});
