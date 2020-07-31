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
    tree = await callRule(
      updateJsonInTree('project1/.eslintrc', () => ({
        parserOptions: {
          project: '../tsconfig.base.json',
        },
      })),
      tree
    );
    tree = await callRule(
      updateJsonInTree('project2/.eslintrc', () => ({
        parserOptions: {
          project: './tsconfig.json',
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
    expect(eslintrc.parserOptions.project).toEqual('./tsconfig.*.json');
  });

  it('should reference tsconfig.*.json from .eslintrc files not in the root', async () => {
    const result = await runMigration(
      'migrate-eslintrc-tsconfig-wildcard',
      {},
      tree
    );
    const eslintrc = readJsonInTree(result, 'project1/.eslintrc');
    expect(eslintrc.parserOptions.project).toEqual('../tsconfig.*.json');
  });

  it("should reference tsconfig.base.json in .eslintrc that don't reference the root tsconfig.json", async () => {
    const result = await runMigration(
      'migrate-eslintrc-tsconfig-wildcard',
      {},
      tree
    );
    const eslintrc = readJsonInTree(result, 'project2/.eslintrc');
    expect(eslintrc.parserOptions.project).toEqual('./tsconfig.json');
  });
});
