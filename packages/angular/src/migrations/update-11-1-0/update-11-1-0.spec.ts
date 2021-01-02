import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { callRule, runMigration } from '../../utils/testing';

describe('update-11-1-0', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = Tree.empty();
    tree = await callRule(
      updateJsonInTree('package.json', () => ({
        devDependencies: {
          '@angular-eslint/eslint-plugin': '~1.0.0',
          '@angular-eslint/eslint-plugin-template': '~1.0.0',
          '@angular-eslint/template-parser': '~1.0.0',
        },
      })),
      tree
    );
  });
  it('should update @angular-eslint dependencies to v1', async () => {
    const result = await runMigration('update-11-1-0', {}, tree);

    const packageJson = readJsonInTree(result, 'package.json');

    expect(packageJson).toMatchInlineSnapshot(`
      Object {
        "devDependencies": Object {
          "@angular-eslint/eslint-plugin": "~1.0.0",
          "@angular-eslint/eslint-plugin-template": "~1.0.0",
          "@angular-eslint/template-parser": "~1.0.0",
        },
      }
    `);
  });
});
