import { chain, Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import {
  callRule,
  createLibWithTests,
  runMigration,
} from '../../utils/testing';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

describe('Update 8.10.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should fix projects with invalid tslint configs', async () => {
    tree = await callRule(
      chain([
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'proj-with-invalid-tslint',
            root: 'proj-with-invalid-tslint',
          });
        }),
        updateJsonInTree('proj-with-invalid-tslint/tslint.json', () => ({
          rules: [],
        })),
      ]),
      tree
    );

    const result = await runMigration('fix-tslint-json', {}, tree);

    expect(
      readJsonInTree(result, 'proj-with-invalid-tslint/tslint.json').rules
    ).toEqual({});
  });

  it('should fix projects with valid tslint configs', async () => {
    tree = await callRule(
      chain([
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'proj-with-valid-tslint',
            root: 'proj-with-valid-tslint',
          });
        }),
        updateJsonInTree('proj-with-valid-tslint/tslint.json', () => ({
          rules: {
            rule: [true],
          },
        })),
      ]),
      tree
    );

    const result = await runMigration('fix-tslint-json', {}, tree);

    expect(
      readJsonInTree(result, 'proj-with-valid-tslint/tslint.json').rules
    ).toEqual({
      rule: [true],
    });
  });

  it('should not add tslint configs to projects without tslint configs', async () => {
    tree = await callRule(
      chain([
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'proj-without-tslint',
            root: 'proj-without-tslint',
          });
        }),
      ]),
      tree
    );

    const result = await runMigration('fix-tslint-json', {}, tree);

    expect(result.exists('proj-without-tslint/tslint.json')).toEqual(false);
  });
});
