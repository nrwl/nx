import { Tree } from '@angular-devkit/schematics';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';

describe('Solution Tsconfigs Migration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = await callRule(
      updateJsonInTree('tsconfig.json', () => ({
        compilerOptions: {
          target: 'es2015',
        },
      })),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/app1/tsconfig.json', () => ({
        extends: '../../tsconfig.json',
        compilerOptions: {
          module: 'commonjs',
        },
      })),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/app1/tsconfig.spec.json', () => ({
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'esnext',
        },
      })),
      tree
    );
  });

  it('should rename tsconfig.json', async () => {
    const result = await runMigration('solution-tsconfigs', {}, tree);
    expect(result.exists('tsconfig.base.json')).toEqual(true);
    expect(result.exists('tsconfig.json')).toEqual(false);
  });

  it('should update tsconfig.base.json', async () => {
    const result = await runMigration('solution-tsconfigs', {}, tree);
    const json = readJsonInTree(result, 'tsconfig.base.json');
    expect(json).toEqual({
      compilerOptions: {
        target: 'es2015',
      },
    });
  });

  it('should extend tsconfig.base.json in tsconfigs that extended tsconfig.json', async () => {
    const result = await runMigration('solution-tsconfigs', {}, tree);
    const json = readJsonInTree(result, 'apps/app1/tsconfig.json');
    expect(json).toEqual({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        module: 'commonjs',
      },
      files: [],
      include: [],
      references: [
        {
          path: './tsconfig.spec.json',
        },
      ],
    });
  });
});
