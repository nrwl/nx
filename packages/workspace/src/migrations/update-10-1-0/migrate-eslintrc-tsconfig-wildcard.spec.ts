import { Tree } from '@angular-devkit/schematics';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';

describe('Eslintrc Migration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = await callRule(
      updateJsonInTree('.eslintrc', () => ({
        parserOptions: {
          project: './tsconfig.base.json',
        },
      })),
      tree
    );
  });

  it('should reference tsconfig.*.json', async () => {
    const result = await runMigration(
      'migrate-eslintrc-tsconfig-wildcard',
      {},
      tree
    );
    const eslintrc = readJsonInTree(result, '.eslintrc');
    expect(eslintrc.parserOptions.project).toEqual('./tsconfig.*?.json');
  });
});
