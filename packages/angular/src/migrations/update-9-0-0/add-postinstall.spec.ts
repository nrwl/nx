import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { callRule, runMigration } from '../../utils/testing';

describe('add-postinstall', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = Tree.empty();
    tree = await callRule(
      updateJsonInTree('package.json', () => ({})),
      tree
    );
  });
  it('should add a postinstall for "ngcc"', async () => {
    const result = await runMigration('add-postinstall', {}, tree);

    const packageJson = readJsonInTree(result, 'package.json');

    expect(packageJson.scripts.postinstall).toEqual(
      'ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points'
    );
  });
});
