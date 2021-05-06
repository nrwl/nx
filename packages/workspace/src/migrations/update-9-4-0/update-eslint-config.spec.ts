import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

describe('Update eslint config for 9.4.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'proj1',
          root: 'proj1',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                config: 'proj1/tslint.json',
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
                linter: 'eslint',
                config: 'proj2/.eslintrc',
              },
              configurations: {
                prod: {
                  linter: 'eslint',
                  config: 'proj2/.eslintrc',
                },
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj3',
          root: 'proj3',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'tslint',
                config: 'proj3/tslint.json',
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj4',
          root: 'proj4',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'eslint',
                config: 'proj4/.eslintrc.custom',
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj5',
          root: 'proj5',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
            },
          },
        });
        workspace.projects.add({
          name: 'proj6',
          root: 'proj6',
        });
      }),
      tree
    );
  });

  it('should remove config builder option when using eslint', async () => {
    const result = await runMigration('update-eslint-config', {}, tree);

    const json = readWorkspace(result);

    expect(json.projects.proj1.architect.lint.options.config).toMatch(
      'proj1/tslint.json'
    );
    expect(json.projects.proj2.architect.lint.options.config).toBeUndefined();
    expect(
      json.projects.proj2.architect.lint.configurations.prod.config
    ).toBeUndefined();
    expect(json.projects.proj3.architect.lint.options.config).toMatch(
      'proj3/tslint.json'
    );
    expect(json.projects.proj4.architect.lint.options.config).toMatch(
      'proj4/.eslintrc.custom'
    );
  });
});
