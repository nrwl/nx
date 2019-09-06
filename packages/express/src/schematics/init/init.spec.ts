import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { callRule, runSchematic } from '../../utils/testing';

describe('init', () => {
  let tree: Tree;
  let testRunner: SchematicTestRunner;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    testRunner = new SchematicTestRunner(
      '@nrwl/express',
      join(__dirname, '../../../collection.json')
    );
  });

  it('should add dependencies', async () => {
    const result = await testRunner
      .runSchematicAsync('init', {}, tree)
      .toPromise();
    const packageJson = readJsonInTree(result, 'package.json');
    expect(packageJson.dependencies['@nrwl/express']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/express']).toBeDefined();
    expect(packageJson.dependencies['express']).toBeDefined();
    expect(packageJson.devDependencies['@types/express']).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('init', {}, tree);
      const workspaceJson = readJsonInTree(result, 'workspace.json');
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/express');
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
      expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/express');
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
