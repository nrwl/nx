import { Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';
import {
  DependencyType,
  ProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/workspace/src/core/project-graph', () => ({
  ...jest.requireActual<any>('@nrwl/workspace/src/core/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('add-template-support-and-presets-to-eslint', () => {
  describe('tslint-only workspace', () => {
    let tree: Tree;
    beforeEach(async () => {
      tree = Tree.empty();
      tree = createEmptyWorkspace(tree);
      tree = await callRule(
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'app1',
            root: 'apps/app1',
            sourceRoot: 'apps/app1/src',
            projectType: 'application',
            targets: {
              lint: {
                builder: '@angular-devkit/build-angular:tslint',
                options: {
                  tsConfig: [
                    'apps/app1/tsconfig.app.json',
                    'apps/app1/tsconfig.spec.json',
                  ],
                  exclude: ['**/node_modules/**', '!apps/app1/**/*'],
                },
              },
            },
          });
          workspace.projects.add({
            name: 'lib1',
            root: 'libs/lib1',
            sourceRoot: 'apps/lib1/src',
            projectType: 'library',
            targets: {
              lint: {
                builder: '@angular-devkit/build-angular:tslint',
                options: {
                  tsConfig: [
                    'libs/lib1/tsconfig.app.json',
                    'libs/lib1/tsconfig.spec.json',
                  ],
                  exclude: ['**/node_modules/**', '!libs/lib1/**/*'],
                },
              },
            },
          });
        }),
        tree
      );
      tree = await callRule(
        updateJsonInTree('nx.json', (json) => {
          json.projects['app1'] = {};
          json.projects['lib1'] = {};

          return json;
        }),
        tree
      );
      tree = await callRule(
        updateJsonInTree('package.json', (json) => {
          json.dependencies['@angular/core'] = '11.0.0';

          return json;
        }),
        tree
      );

      projectGraph = {
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              files: [],
              root: 'apps/app1',
            },
          },
          app2: {
            name: 'app2',
            type: 'app',
            data: {
              files: [],
              root: 'apps/app2',
            },
          },
          lib1: {
            name: 'lib1',
            type: 'app',
            data: {
              files: [],
              root: 'apps/lib1',
            },
          },
        },
        externalNodes: {
          'npm:@angular/core': {
            name: 'npm:@angular/core',
            type: 'npm',
            data: {
              version: '1',
              packageName: '@angular/core',
            },
          },
        },
        dependencies: {
          app1: [
            {
              type: DependencyType.static,
              source: 'app1',
              target: 'npm:@angular/core',
            },
          ],
          app2: [
            {
              type: DependencyType.static,
              source: 'app2',
              target: 'npm:@angular/core',
            },
          ],
          lib1: [
            {
              type: DependencyType.static,
              source: 'lib1',
              target: 'npm:@angular/core',
            },
          ],
          'npm:@angular/core': [],
        },
      };
    });

    it('should do nothing', async () => {
      const packageJsonBefore = JSON.parse(
        tree.read('package.json').toString()
      );

      const result = await runMigration(
        'add-template-support-and-presets-to-eslint',
        {},
        tree
      );

      expect(packageJsonBefore).toEqual(
        JSON.parse(result.read('package.json').toString())
      );
    });
  });

  describe('workspace with at least one eslint project', () => {
    let tree: Tree;
    beforeEach(async () => {
      tree = Tree.empty();
      tree = createEmptyWorkspace(tree);
      tree = await callRule(
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'app1',
            root: 'apps/app1',
            sourceRoot: 'apps/app1/src',
            projectType: 'application',
            prefix: 'customprefix',
            targets: {
              lint: {
                builder: '@nrwl/linter:eslint',
                options: {
                  lintFilePatterns: ['apps/app1/src/**/*.ts'],
                },
              },
            },
          });
          // App still using TSLint, will be unaffected
          workspace.projects.add({
            name: 'app2',
            root: 'apps/app2',
            sourceRoot: 'apps/app2/src',
            projectType: 'library',
            targets: {
              lint: {
                builder: '@angular-devkit/build-angular:tslint',
                options: {
                  tsConfig: [
                    'apps/app2/tsconfig.app.json',
                    'apps/app2/tsconfig.spec.json',
                  ],
                  exclude: ['**/node_modules/**', '!apps/app2/**/*'],
                },
              },
            },
          });
          workspace.projects.add({
            name: 'lib1',
            root: 'libs/lib1',
            sourceRoot: 'libs/lib1/src',
            projectType: 'application',
            // No custom prefix, will fall back to npm scope in nx.json
            prefix: undefined,
            targets: {
              lint: {
                builder: '@nrwl/linter:eslint',
                options: {
                  lintFilePatterns: ['libs/lib1/src/**/*.ts'],
                },
              },
            },
          });
        }),
        tree
      );
      tree = await callRule(
        updateJsonInTree('nx.json', (json) => {
          json.projects['app1'] = {};
          json.projects['app2'] = {};
          json.projects['lib1'] = {};

          return json;
        }),
        tree
      );
      tree = await callRule(
        updateJsonInTree('package.json', (json) => {
          json.dependencies['@angular/core'] = '11.0.0';

          return json;
        }),
        tree
      );
      tree.create('apps/app1/src/main.ts', `import '@angular/core';`);
      tree.create('libs/lib1/src/index.ts', `import '@angular/core';`);
    });

    it('should do nothing if the root eslint config has not been updated to use overrides by the latest migrations', async () => {
      tree.create(
        '.eslintrc.json',
        JSON.stringify({
          // no overrides here, so can't have been updated/generated by latest Nx
          rules: {},
        })
      );

      const packageJsonBefore = JSON.parse(
        tree.read('package.json').toString()
      );

      const result = await runMigration(
        'add-template-support-and-presets-to-eslint',
        {},
        tree
      );

      expect(packageJsonBefore).toEqual(
        JSON.parse(result.read('package.json').toString())
      );
    });

    it(`should update the workspace package.json if they are using the latest eslint config from Nx`, async () => {
      tree.create(
        '.eslintrc.json',
        JSON.stringify({
          overrides: [
            {
              files: [],
              rules: {},
            },
          ],
        })
      );

      const packageJsonBefore = JSON.parse(
        tree.read('package.json').toString()
      );

      const result = await runMigration(
        'add-template-support-and-presets-to-eslint',
        {},
        tree
      );

      expect(packageJsonBefore).toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "@angular/core": "11.0.0",
          },
          "devDependencies": Object {},
          "name": "test-name",
        }
      `);

      expect(JSON.parse(result.read('package.json').toString()))
        .toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "@angular/core": "11.0.0",
          },
          "devDependencies": Object {
            "@angular-eslint/eslint-plugin": "~1.0.0",
            "@angular-eslint/eslint-plugin-template": "~1.0.0",
            "@angular-eslint/template-parser": "~1.0.0",
          },
          "name": "test-name",
        }
      `);
    });

    it(`should update any relevant project .eslintrc.json files`, async () => {
      tree.create(
        '.eslintrc.json',
        JSON.stringify({
          overrides: [
            {
              files: [],
              rules: {},
            },
          ],
        })
      );

      tree.create(
        'apps/app1/.eslintrc.json',
        JSON.stringify({
          rules: {},
        })
      );
      tree.create(
        'libs/lib1/.eslintrc.json',
        JSON.stringify({
          rules: {},
        })
      );

      const result = await runMigration(
        'add-template-support-and-presets-to-eslint',
        {},
        tree
      );

      expect(JSON.parse(result.read('apps/app1/.eslintrc.json').toString()))
        .toMatchInlineSnapshot(`
        Object {
          "extends": "../../.eslintrc.json",
          "ignorePatterns": Array [
            "!**/*",
          ],
          "overrides": Array [
            Object {
              "extends": Array [
                "plugin:@nrwl/nx/angular",
                "plugin:@angular-eslint/template/process-inline-templates",
              ],
              "files": Array [
                "*.ts",
              ],
              "parserOptions": Object {
                "project": Array [
                  "apps/app1/tsconfig.*?.json",
                ],
              },
              "rules": Object {
                "@angular-eslint/component-selector": Array [
                  "error",
                  Object {
                    "prefix": "customprefix",
                    "style": "kebab-case",
                    "type": "element",
                  },
                ],
                "@angular-eslint/directive-selector": Array [
                  "error",
                  Object {
                    "prefix": "customprefix",
                    "style": "camelCase",
                    "type": "attribute",
                  },
                ],
              },
            },
            Object {
              "extends": Array [
                "plugin:@nrwl/nx/angular-template",
              ],
              "files": Array [
                "*.html",
              ],
              "rules": Object {},
            },
          ],
        }
      `);

      expect(JSON.parse(result.read('libs/lib1/.eslintrc.json').toString()))
        .toMatchInlineSnapshot(`
        Object {
          "extends": "../../.eslintrc.json",
          "ignorePatterns": Array [
            "!**/*",
          ],
          "overrides": Array [
            Object {
              "extends": Array [
                "plugin:@nrwl/nx/angular",
                "plugin:@angular-eslint/template/process-inline-templates",
              ],
              "files": Array [
                "*.ts",
              ],
              "parserOptions": Object {
                "project": Array [
                  "libs/lib1/tsconfig.*?.json",
                ],
              },
              "rules": Object {
                "@angular-eslint/component-selector": Array [
                  "error",
                  Object {
                    "prefix": "proj",
                    "style": "kebab-case",
                    "type": "element",
                  },
                ],
                "@angular-eslint/directive-selector": Array [
                  "error",
                  Object {
                    "prefix": "proj",
                    "style": "camelCase",
                    "type": "attribute",
                  },
                ],
              },
            },
            Object {
              "extends": Array [
                "plugin:@nrwl/nx/angular-template",
              ],
              "files": Array [
                "*.html",
              ],
              "rules": Object {},
            },
          ],
        }
      `);
    });

    it(`should update any relevant project builder configuration to include HTML templates`, async () => {
      tree.create(
        '.eslintrc.json',
        JSON.stringify({
          overrides: [
            {
              files: [],
              rules: {},
            },
          ],
        })
      );

      tree.create(
        'apps/app1/.eslintrc.json',
        JSON.stringify({
          rules: {},
        })
      );
      tree.create(
        'libs/lib1/.eslintrc.json',
        JSON.stringify({
          rules: {},
        })
      );

      const result = await runMigration(
        'add-template-support-and-presets-to-eslint',
        {},
        tree
      );

      const workspace = readJsonInTree(result, 'workspace.json');

      expect(workspace.projects['app1'].architect).toMatchInlineSnapshot(`
        Object {
          "lint": Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "apps/app1/src/**/*.ts",
                "apps/app1/src/**/*.html",
              ],
            },
          },
        }
      `);

      expect(workspace.projects['lib1'].architect).toMatchInlineSnapshot(`
        Object {
          "lint": Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "libs/lib1/src/**/*.ts",
                "libs/lib1/src/**/*.html",
              ],
            },
          },
        }
      `);
    });
  });
});
