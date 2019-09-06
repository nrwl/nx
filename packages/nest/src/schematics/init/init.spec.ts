import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { runSchematic, callRule } from '../../utils/testing';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should add dependencies', async () => {
    const result = await runSchematic('init', {}, tree);
    const packageJson = readJsonInTree(result, 'package.json');

    expect(packageJson.dependencies['@nrwl/nest']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/nest']).toBeDefined();
    expect(packageJson.dependencies['@nestjs/core']).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/nest');
    });

    it('should be set if @nrwl/workspace was set before', async () => {
      tree = await callRule(
        updateJsonInTree('workspace.json', json => {
          json.cli = {
            defaultCollection: '@nrwl/workspace'
          };

          return json;
        }),
        tree
      );
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/nest');
    });

    it('should not be set if something else was set before', async () => {
      tree = await callRule(
        updateJsonInTree('workspace.json', json => {
          json.cli = {
            defaultCollection: '@nrwl/angular'
          };

          return json;
        }),
        tree
      );
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/angular');
    });
  });
});
