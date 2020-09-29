import { Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  readWorkspace,
  updateJsonInTree,
} from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';

describe('Update eslint builder and config for 10.3.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateJsonInTree('.eslintrc', () => ({
        parserOptions: {
          project: './tsconfig.json',
        },
      })),
      tree
    );
    tree = await callRule(
      updateJsonInTree('project1/.eslintrc', () => ({
        parserOptions: {
          project: '../tsconfig.json',
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

  it('should work', async () => {
    const result = await runMigration(
      'update-eslint-builder-and-config',
      {},
      tree
    );

    const json = readWorkspace(result);

    expect(json).toBeDefined();
  });
});
