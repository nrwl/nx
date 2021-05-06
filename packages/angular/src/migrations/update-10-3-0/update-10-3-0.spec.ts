import { callRule, runMigration } from '../../utils/testing';
import { chain, Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('update-10.3.0', () => {
  describe('tsconfig.editor.json migration', () => {
    let tree: Tree;
    beforeAll(async () => {
      tree = Tree.empty();
      tree = createEmptyWorkspace(tree);
      tree = await callRule(
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'app1',
            root: 'apps/app1',
            targets: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
                options: {
                  tsConfig: 'apps/app1/tsconfig.app.json',
                },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
              },
            },
          });
          workspace.projects.add({
            name: 'app2',
            root: 'apps/app2',
            targets: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
                options: {
                  tsConfig: 'apps/app2/tsconfig.app.json',
                },
              },
              test: {
                builder: '@nrwl/jest:jest',
              },
            },
          });
          workspace.projects.add({
            name: 'app3',
            root: 'apps/app3',
            targets: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
                options: {
                  tsConfig: 'apps/app3/tsconfig.app.json',
                },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
              },
              test2: {
                builder: '@nrwl/jest:jest',
              },
            },
          });
          workspace.projects.add({
            name: 'app4',
            root: 'apps/app4',
            targets: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
                options: {
                  tsConfig: 'apps/app4/tsconfig.app.json',
                },
              },
            },
          });
          workspace.projects.add({
            name: 'app5',
            root: 'apps/app5',
            targets: {},
          });
        }),
        tree
      );
      tree = await callRule(
        chain([
          updateJsonInTree('apps/app1/tsconfig.app.json', () => ({
            extends: './tsconfig.json',
          })),
          updateJsonInTree('apps/app1/tsconfig.json', () => ({
            references: [],
          })),
          updateJsonInTree('apps/app2/tsconfig.app.json', () => ({
            extends: './tsconfig.json',
          })),
          updateJsonInTree('apps/app2/tsconfig.json', () => ({
            references: [],
          })),
          updateJsonInTree('apps/app3/tsconfig.app.json', () => ({
            extends: './tsconfig.json',
          })),
          updateJsonInTree('apps/app3/tsconfig.json', () => ({
            references: [],
          })),
          updateJsonInTree('apps/app4/tsconfig.app.json', () => ({
            extends: './tsconfig.json',
          })),
          updateJsonInTree('apps/app4/tsconfig.json', () => ({
            references: [],
          })),
        ]),
        tree
      );
      tree = await runMigration('update-10-3-0', {}, tree);
    });

    it('should create an tsconfig.editor.json for karma', async () => {
      const tsconfig = readJsonInTree(tree, 'apps/app1/tsconfig.editor.json');
      expect(tsconfig).toEqual({
        compilerOptions: {
          types: ['jasmine', 'node'],
        },
        extends: './tsconfig.json',
        include: ['**/*.ts'],
      });
    });

    it('should add references to base config', () => {
      expect(
        readJsonInTree(tree, 'apps/app1/tsconfig.json').references
      ).toContainEqual({
        path: './tsconfig.editor.json',
      });
      expect(
        readJsonInTree(tree, 'apps/app2/tsconfig.json').references
      ).toContainEqual({
        path: './tsconfig.editor.json',
      });
      expect(
        readJsonInTree(tree, 'apps/app3/tsconfig.json').references
      ).toContainEqual({
        path: './tsconfig.editor.json',
      });
      expect(
        readJsonInTree(tree, 'apps/app4/tsconfig.json').references
      ).toContainEqual({
        path: './tsconfig.editor.json',
      });
    });

    it('should create an tsconfig.editor.json for jest', async () => {
      const tsconfig = readJsonInTree(tree, 'apps/app2/tsconfig.editor.json');
      expect(tsconfig).toEqual({
        compilerOptions: {
          types: ['jest', 'node'],
        },
        extends: './tsconfig.json',
        include: ['**/*.ts'],
      });
    });

    it('should create an tsconfig.editor.json for jest and karma', async () => {
      const tsconfig = readJsonInTree(tree, 'apps/app3/tsconfig.editor.json');
      expect(tsconfig).toEqual({
        compilerOptions: {
          types: ['jest', 'jasmine', 'node'],
        },
        extends: './tsconfig.json',
        include: ['**/*.ts'],
      });
    });

    it('should create an tsconfig.editor.json for no unit test runners', async () => {
      const tsconfig = readJsonInTree(tree, 'apps/app4/tsconfig.editor.json');
      expect(tsconfig).toEqual({
        compilerOptions: {
          types: ['node'],
        },
        extends: './tsconfig.json',
        include: ['**/*.ts'],
      });
    });

    it('should not create a tsconfig.editor.json for non-angular projects', async () => {
      expect(tree.exists('apps/app5/tsconfig.editor.json')).toBeFalsy();
    });
  });
});
