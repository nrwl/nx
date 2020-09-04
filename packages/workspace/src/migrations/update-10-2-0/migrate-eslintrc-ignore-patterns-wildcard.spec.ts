import { Tree } from '@angular-devkit/schematics';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';

describe('Eslintrc Migration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = await callRule(
      updateJsonInTree('.eslintrc', () => ({
        ignorePatterns: ['!**/*'],
      })),
      tree
    );
  });

  it('should lint only `src` folder', async () => {
    const result = await runMigration(
      'migrate-eslintrc-ignore-patterns-wildcard',
      {},
      tree
    );
    const eslintrc = readJsonInTree(result, '.eslintrc');
    expect(eslintrc.ignorePatterns).toEqual(['/*.*', '!src/**/*']);
  });
});
