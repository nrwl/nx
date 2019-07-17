import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { updateJsonInTree } from '@nrwl/workspace';
import { runSchematic, callRule } from '../../utils/testing';

describe('ng-add', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should add react dependencies', async () => {
    const result = await runSchematic('ng-add', {}, tree);
    const packageJson = readJsonInTree(result, 'package.json');
    expect(packageJson.dependencies['@nrwl/react']).toBeUndefined();
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['react-dom']).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/react']).toBeDefined();
    expect(packageJson.devDependencies['@types/react']).toBeDefined();
    expect(packageJson.devDependencies['@types/react-dom']).toBeDefined();
    expect(packageJson.devDependencies['@testing-library/react']).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = await runSchematic('ng-add', {}, tree);
      const angularJson = readJsonInTree(result, 'angular.json');
      expect(angularJson.cli.defaultCollection).toEqual('@nrwl/react');
    });

    it('should be set if @nrwl/workspace was set before', async () => {
      tree = await callRule(
        updateJsonInTree('angular.json', json => {
          json.cli = {
            defaultCollection: '@nrwl/workspace'
          };

          return json;
        }),
        tree
      );
      const result = await runSchematic('ng-add', {}, tree);
      const angularJson = readJsonInTree(result, 'angular.json');
      expect(angularJson.cli.defaultCollection).toEqual('@nrwl/react');
    });

    it('should not be set if something else was set before', async () => {
      tree = await callRule(
        updateJsonInTree('angular.json', json => {
          json.cli = {
            defaultCollection: '@nrwl/angular'
          };

          return json;
        }),
        tree
      );
      const result = await runSchematic('ng-add', {}, tree);
      const angularJson = readJsonInTree(result, 'angular.json');
      expect(angularJson.cli.defaultCollection).toEqual('@nrwl/angular');
    });
  });
});
