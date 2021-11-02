import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

describe('Update eslint and tslint exclude pattern for 9.4.0', () => {
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
              builder: 'some-other-linter',
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
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                linter: 'eslint',
                exclude: ['!apps/proj3/**', '**/node_modules/**'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj4',
          root: 'apps/proj4',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                linter: 'tslint',
                exclude: ['!apps/proj4/*', '**/node_modules/**'],
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
                linter: 'tslint',
                exclude: ['!apps/proj5/*', '**/node_modules/**'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj6',
          root: 'libs/proj6',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                linter: 'eslint',
                exclude: [
                  '**/node_modules/**',
                  'libs/proj6/**',
                  '!libs/proj6/**',
                ],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj7',
          root: 'libs/proj7',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'eslint',
                exclude: [
                  '**/node_modules/**',
                  'libs/proj7/**',
                  '!libs/proj7/**',
                ],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'proj8',
          root: 'proj8',
          architect: {
            lint: {
              builder: '@nrwl/linter:lint',
            },
          },
        });
        workspace.projects.add({
          name: 'proj9',
          root: 'proj9',
        });
      }),
      tree
    );
  });

  it('should fix the exclude option when using tslint', async () => {
    const result = await runMigration('update-linters-exclude', {}, tree);

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
      '!apps/proj3/**/*',
      '**/node_modules/**',
    ]);
    expect(json.projects.proj4.architect.lint.options.exclude).toEqual([
      '!apps/proj4/*',
      '**/node_modules/**',
    ]);
    expect(json.projects.proj5.architect.lint.options.exclude).toEqual([
      '!apps/proj5/*',
      '**/node_modules/**',
    ]);
    expect(json.projects.proj6.architect.lint.options.exclude).toEqual([
      '**/node_modules/**',
      'libs/proj6/**',
      '!libs/proj6/**/*',
    ]);
    expect(json.projects.proj7.architect.lint.options.exclude).toEqual([
      '**/node_modules/**',
      'libs/proj7/**',
      '!libs/proj7/**/*',
    ]);
  });
});
