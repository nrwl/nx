import { chain, Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

describe('Update 9.1.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should update tslint.json', async () => {
    tree = await callRule(
      chain([
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'proj1',
            root: 'proj1',
            architect: {
              lint: {
                builder: '@angular-devkit/build-angular:tslint',
              },
            },
          });
          workspace.projects.add({
            name: 'proj2',
            root: 'proj2',
            architect: {
              lint: {
                builder: '@angular-devkit/build-angular:tslint',
              },
            },
          });
        }),
        updateJsonInTree('proj1/tslint.json', () => ({
          rules: {},
        })),
        updateJsonInTree('proj2/tslint.json', () => ({
          rules: {},
          linterOptions: {
            exclude: ['whatever'],
          },
        })),
      ]),
      tree
    );

    const result = await runMigration('update-lint-config-9-1-0', {}, tree);

    expect(readJsonInTree(result, 'proj1/tslint.json')).toEqual({
      rules: {},
      linterOptions: {
        exclude: ['!**/*'],
      },
    });

    expect(readJsonInTree(result, 'proj2/tslint.json')).toEqual({
      rules: {},
      linterOptions: {
        exclude: ['!**/*', 'whatever'],
      },
    });
  });

  it('should update .eslintrc', async () => {
    tree = await callRule(
      chain([
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'proj1',
            root: 'proj1',
            architect: {
              lint: {
                builder: '@nrwl/linter:lint',
                options: {
                  config: 'proj1/.eslintrc',
                },
              },
            },
          });
          workspace.projects.add({
            name: 'proj2',
            root: 'proj2',
            architect: {
              lint: {
                builder: '@nrwl/linter:lint',
                options: {
                  config: 'proj2/.eslintrc',
                },
              },
            },
          });
        }),
        updateJsonInTree('proj1/.eslintrc', () => ({
          rules: {},
        })),
        updateJsonInTree('proj2/.eslintrc', () => ({
          rules: {},
          ignorePatterns: ['whatever'],
        })),
      ]),
      tree
    );

    const result = await runMigration('update-lint-config-9-1-0', {}, tree);

    expect(readJsonInTree(result, 'proj1/.eslintrc')).toEqual({
      rules: {},
      ignorePatterns: ['!**/*'],
    });

    expect(readJsonInTree(result, 'proj2/.eslintrc')).toEqual({
      rules: {},
      ignorePatterns: ['!**/*', 'whatever'],
    });
  });
});
