import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree, updateJsonInTree } from '../ast-utils';
import { callRule } from '../testing';
import { removeDependency } from './npm-dependencies';

describe('NPM Dependencies', () => {
  let tree: UnitTestTree;

  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());
  });

  describe('removeDependency', () => {
    beforeEach(() => {
      tree.create(
        'package.json',
        JSON.stringify({
          name: 'ast-utils',
          dependencies: {},
          devDependencies: {}
        })
      );
    });

    const depName = '@nrwl/workspace';

    it('should remove dependency', async () => {
      tree = new UnitTestTree(
        await callRule(
          updateJsonInTree('package.json', json => {
            const testDeps = {
              [depName]: '1.0.0'
            };
            json.dependencies = {
              ...json.dependencies,
              ...testDeps
            };
            json.devDependencies = {
              ...json.devDependencies,
              ...testDeps
            };
            return json;
          }),
          tree
        )
      );

      await callRule(removeDependency(depName), tree);

      const updatedPackageJson = readJsonInTree(tree, 'package.json');
      expect(updatedPackageJson.devDependencies[depName]).not.toBeUndefined();
      expect(updatedPackageJson.dependencies[depName]).toBeUndefined();
    });
  });
});
