import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

describe('Update eslint exclude pattern for 9.4.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'proj1',
          root: 'apps/proj1',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                exclude: ['**/node_modules/**', '!apps/proj1/**'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj2',
          root: 'apps/proj2',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'eslint',
                exclude: ['!apps/proj2/**', '**/node_modules/**'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj3',
          root: 'apps/proj3',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'tslint',
                exclude: ['!apps/proj3/*', '**/node_modules/**'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj4',
          root: 'libs/proj4',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'eslint',
                exclude: [
                  '**/node_modules/**',
                  'libs/proj4/**',
                  '!libs/proj4/**',
                ],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj5',
          root: 'apps/proj5',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                exclude: ['**/node_modules/**', '!apps/proj5/**'],
              },
            },
          },
        });
      }),
      tree
    );
  });

  it('should fix the exclude option when using eslint', async () => {
    const result = await runMigration('update-eslint-exclude', {}, tree);

    const json = readWorkspace(result);

    expect(json.projects.proj1.architect.lint.options.exclude).toEqual([
      '**/node_modules/**',
      '!apps/proj1/**',
    ]);
    expect(json.projects.proj2.architect.lint.options.exclude).toEqual([
      '!apps/proj2/**/*',
      '**/node_modules/**',
    ]);
    expect(json.projects.proj3.architect.lint.options.exclude).toEqual([
      '!apps/proj3/*',
      '**/node_modules/**',
    ]);
    expect(json.projects.proj4.architect.lint.options.exclude).toEqual([
      '**/node_modules/**',
      'libs/proj4/**',
      '!libs/proj4/**/*',
    ]);
    expect(json.projects.proj5.architect.lint.options.exclude).toEqual([
      '**/node_modules/**',
      '!apps/proj5/**/*',
    ]);
  });
});
