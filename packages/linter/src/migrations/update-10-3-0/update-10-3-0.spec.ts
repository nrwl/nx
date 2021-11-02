import { runMigration } from '../../utils/testing';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';

describe('Update 10.3.0', () => {
  let tree: UnitTestTree;
  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());
    tree.create('.eslintrc', '{}');
  });

  it('should disable the "@typescript-eslint/explicit-module-boundary-types" rule', async () => {
    const result = await runMigration('update-10.3.0', {}, tree);
    expect(
      readJsonInTree(result, '.eslintrc').rules[
        '@typescript-eslint/explicit-module-boundary-types'
      ]
    ).toEqual('off');
  });
});
