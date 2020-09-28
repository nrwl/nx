import { Tree } from '@angular-devkit/schematics';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('add VsCode extensions file', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());
    tree = await callRule(
      updateJsonInTree('.vscode/extensions.json', () => ({
        recommendations: ['alreadyhere.something'],
      })),
      tree
    );
  });

  it('add a jest extension', async () => {
    const result = await runMigration('add-jest-extension', {}, tree);
    const extensions = readJsonInTree(result, '.vscode/extensions.json');
    expect(extensions).toMatchInlineSnapshot(`
      Object {
        "recommendations": Array [
          "alreadyhere.something",
          "firsttris.vscode-jest-runner",
        ],
      }
    `);
  });
});
