import { chain, Tree } from '@angular-devkit/schematics';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree, updateWorkspace } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('add VsCode extensions file', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());
  });

  it('add a extensions.json file', async () => {
    const result = await runMigration('add-vscode-extensions', {}, tree);
    const extensions = readJsonInTree(result, '.vscode/extensions.json');
    expect(extensions).toMatchInlineSnapshot(`
      Object {
        "recommendations": Array [
          "nrwl.angular-console",
          "ms-vscode.vscode-typescript-tslint-plugin",
          "esbenp.prettier-vscode",
        ],
      }
    `);
  });

  describe('angular builders', () => {
    beforeEach(async () => {
      tree = await callRule(
        chain([
          updateWorkspace((workspace) => {
            workspace.projects
              .add({
                name: 'project',
                root: 'apps/project',
                sourceRoot: 'apps/project/src',
              })
              .targets.add({
                builder: '@nrwl/node:builder',
                name: 'builder',
              });

            workspace.projects
              .add({
                name: 'angular-project',
                root: 'apps/angular-project',
                sourceRoot: 'apps/angular-project/src',
              })
              .targets.add({
                builder: '@angular-devkit/build-angular:browser',
                name: 'builder',
              });
          }),
        ]),
        tree
      );
    });

    it('add a extensions.json file with the angular extension', async () => {
      const result = await runMigration('add-vscode-extensions', {}, tree);
      const extensions = readJsonInTree(result, '.vscode/extensions.json');
      expect(extensions).toMatchInlineSnapshot(`
        Object {
          "recommendations": Array [
            "nrwl.angular-console",
            "ms-vscode.vscode-typescript-tslint-plugin",
            "esbenp.prettier-vscode",
            "angular.ng-template",
          ],
        }
      `);
    });
  });
});
