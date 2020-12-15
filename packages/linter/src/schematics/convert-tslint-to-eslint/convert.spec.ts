import { join, normalize } from '@angular-devkit/core';
import { chain, Tree } from '@angular-devkit/schematics';
import {
  readWorkspace,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import {
  allFilesInDirInHost,
  readJsonInTree,
} from '@nrwl/workspace/src/utils/ast-utils';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import {
  exampleE2eProjectTslintJson,
  exampleAngularProjectTslintJson,
  exampleRootTslintJson,
  exampleNonAngularProjectTslintJson,
} from './lib/example-tslint-configs';
import { mockFindReportedConfiguration } from './lib/mock-tslint-to-eslint-config';
import { ConvertTSLintToESLintSchema } from './schema';

/**
 * See ./mock-tslint-to-eslint-config.ts for why this is needed
 */
jest.mock('tslint-to-eslint-config', () => {
  return {
    ...jest.requireActual('tslint-to-eslint-config'),
    findReportedConfiguration: jest
      .fn()
      .mockImplementation(mockFindReportedConfiguration),
  };
});

jest.mock('child_process', () => {
  return {
    ...jest.requireActual('child_process'),
    execSync: jest.fn().mockImplementation(() => {}),
  };
});
jest.mock('fs', () => {
  return {
    ...jest.requireActual('fs'),
    writeFileSync: jest.fn().mockImplementation(() => {}),
  };
});

jest.mock('@nrwl/eslint-plugin-nx', () => {
  return {
    configs: {
      angular: {
        env: {
          browser: true,
          es6: true,
          node: true,
        },
      },
      'angular-template': {},
    },
  };
});

describe('convert-tslint-to-eslint', () => {
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
          architect: {
            serve: {
              builder: '@angular-devkit/build-angular:dev-server',
              options: {
                browserTarget: 'app1:build',
              },
              configurations: {
                production: {
                  browserTarget: 'app1:build:production',
                },
              },
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'apps/app1/tsconfig.app.json',
                  'apps/app1/tsconfig.spec.json',
                  'apps/app1/tsconfig.editor.json',
                ],
                exclude: ['**/node_modules/**', '!apps/app1/**/*'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'app1-e2e',
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          architect: {
            e2e: {
              builder: '@nrwl/cypress:cypress',
              options: {
                cypressConfig: 'apps/app1-e2e/cypress.json',
                tsConfig: 'apps/app1-e2e/tsconfig.e2e.json',
                devServerTarget: 'app1:serve',
              },
              configurations: {
                production: {
                  devServerTarget: 'app1:serve:production',
                },
              },
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: ['apps/app1-e2e/tsconfig.e2e.json'],
                exclude: ['**/node_modules/**', '!apps/app1-e2e/**/*'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'lib1',
          root: 'libs/lib1',
          sourceRoot: 'libs/lib1/src',
          projectType: 'library',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'libs/lib1/tsconfig.lib.json',
                  'libs/lib1/tsconfig.spec.json',
                ],
                exclude: ['**/node_modules/**', '!libs/lib1/**/*'],
              },
            },
          },
        });
        workspace.projects.add({
          name: 'app2',
          root: 'apps/app2',
          sourceRoot: 'apps/app2/src',
          projectType: 'application',
          prefix: 'app2',
          architect: {
            build: {
              builder: '@nrwl/node:build',
              outputs: ['{options.outputPath}'],
              options: {
                outputPath: 'dist/apps/app2',
                main: 'apps/app2/src/main.ts',
                tsConfig: 'apps/app2/tsconfig.app.json',
                assets: ['apps/app2/src/assets'],
              },
              configurations: {
                production: {
                  optimization: true,
                  extractLicenses: true,
                  inspect: false,
                  fileReplacements: [
                    {
                      replace: 'apps/app2/src/environments/environment.ts',
                      with: 'apps/app2/src/environments/environment.prod.ts',
                    },
                  ],
                },
              },
            },
            serve: {
              builder: '@nrwl/node:execute',
              options: {
                buildTarget: 'app2:build',
              },
            },
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
            test: {
              builder: '@nrwl/jest:jest',
              outputs: ['coverage/apps/app2'],
              options: {
                jestConfig: 'apps/app2/jest.config.js',
                passWithNoTests: true,
              },
            },
          },
        });
        workspace.projects.add({
          name: 'app2-e2e',
          root: 'apps/app2-e2e',
          sourceRoot: 'apps/app2-e2e/src',
          projectType: 'application',
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: 'apps/app2-e2e/protractor.conf.js',
                devServerTarget: 'app2:serve',
              },
              configurations: {
                production: {
                  devServerTarget: 'app2:serve:production',
                },
              },
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: ['apps/app2-e2e/tsconfig.e2e.json'],
                exclude: ['**/node_modules/**', '!apps/app2-e2e/**/*'],
              },
            },
          },
        });
      }),
      tree
    );
    tree.create('apps/app2-e2e/protractor.conf.js', ``); // will be used to determine that it is a Protractor E2E project
    tree.create('libs/lib1/karma.conf.js', ``); // will be used to determine that it is an Angular library
    tree = await callRule(
      chain([
        updateJsonInTree('tslint.json', () => exampleRootTslintJson.raw),
        updateJsonInTree(
          'apps/app1/tslint.json',
          () => exampleAngularProjectTslintJson.raw
        ),
        updateJsonInTree(
          'apps/app1-e2e/tslint.json',
          () => exampleE2eProjectTslintJson.raw
        ),
        updateJsonInTree(
          'libs/lib1/tslint.json',
          () => exampleAngularProjectTslintJson.raw
        ),
        updateJsonInTree(
          'apps/app2/tslint.json',
          () => exampleNonAngularProjectTslintJson.raw
        ),
      ]),
      tree
    );
    // Source files used to verify the comment conversion logic
    tree.create(
      'libs/lib1/foo.ts',
      `
// tslint:disable-next-line:no-eval
eval('');
    `.trim()
    );
    tree.create(
      'libs/lib1/bar.ts',
      `
/* tslint:disable */
eval('');
/* tslint:enable */
    `.trim()
    );
  });

  it('should update the lint target for the given project in the angular.json', async () => {
    async function runSchematicForProjectAndReadProjectConfig(
      tree: Tree,
      project: string
    ) {
      const updatedWorkspace = await readWorkspace(
        await runSchematic(
          'convert-tslint-to-eslint',
          <ConvertTSLintToESLintSchema>{
            project,
          },
          tree
        )
      );
      return updatedWorkspace.projects[project];
    }

    expect(
      await runSchematicForProjectAndReadProjectConfig(tree, 'app1')
    ).toMatchSnapshot();

    // Cypress E2E Project
    expect(
      await runSchematicForProjectAndReadProjectConfig(tree, 'app1-e2e')
    ).toMatchSnapshot();

    expect(
      await runSchematicForProjectAndReadProjectConfig(tree, 'lib1')
    ).toMatchSnapshot();

    expect(
      await runSchematicForProjectAndReadProjectConfig(tree, 'app2')
    ).toMatchSnapshot();

    // Protractor E2E Project
    expect(
      await runSchematicForProjectAndReadProjectConfig(tree, 'app2-e2e')
    ).toMatchSnapshot();
  });

  it('should create a .eslintrc.json and delete the tslint.json for the given project', async () => {
    async function runSchematicForProjectAndReadESLintConfig(
      tree: Tree,
      project: string
    ) {
      const result = await runSchematic(
        'convert-tslint-to-eslint',
        <ConvertTSLintToESLintSchema>{
          project,
        },
        tree
      );
      const workspace = await readWorkspace(result);
      return readJsonInTree(
        result,
        join(normalize(workspace.projects[project].root), '.eslintrc.json')
      );
    }

    // All files - Before
    expect(allFilesInDirInHost(tree, tree.root.path)).toMatchSnapshot();

    expect(
      await runSchematicForProjectAndReadESLintConfig(tree, 'app1')
    ).toMatchSnapshot();

    // Root ESLint config (which should exist after the schematic has been run at least once)
    expect(await readJsonInTree(tree, '.eslintrc.json')).toMatchSnapshot();

    expect(
      await runSchematicForProjectAndReadESLintConfig(tree, 'app1-e2e')
    ).toMatchSnapshot();

    expect(
      await runSchematicForProjectAndReadESLintConfig(tree, 'lib1')
    ).toMatchSnapshot();

    expect(
      await runSchematicForProjectAndReadESLintConfig(tree, 'app2')
    ).toMatchSnapshot();

    // All files - After
    expect(allFilesInDirInHost(tree, tree.root.path)).toMatchSnapshot();
  });

  it('should add the relevant dependencies to the package.json', async () => {
    // Before
    expect(readJsonInTree(tree, 'package.json')).toMatchInlineSnapshot(`
      Object {
        "dependencies": Object {},
        "devDependencies": Object {},
        "name": "test-name",
      }
    `);

    await readWorkspace(
      await runSchematic(
        'convert-tslint-to-eslint',
        <ConvertTSLintToESLintSchema>{
          project: 'app1',
        },
        tree
      )
    );

    // After
    expect(readJsonInTree(tree, 'package.json')).toMatchInlineSnapshot(`
      Object {
        "dependencies": Object {},
        "devDependencies": Object {
          "@angular-eslint/eslint-plugin": "~1.0.0",
          "@angular-eslint/eslint-plugin-template": "~1.0.0",
          "@angular-eslint/template-parser": "~1.0.0",
          "@nrwl/eslint-plugin-nx": "*",
          "@typescript-eslint/eslint-plugin": "4.3.0",
          "@typescript-eslint/parser": "4.3.0",
          "eslint": "7.10.0",
          "eslint-config-prettier": "6.0.0",
          "eslint-plugin-import": "latest",
        },
        "name": "test-name",
      }
    `);
  });

  it('should replace tslint:disable comments with their eslint equivalents', async () => {
    // Before
    expect(tree.read('libs/lib1/foo.ts').toString()).toMatchInlineSnapshot(`
"// tslint:disable-next-line:no-eval
eval('');"
`);
    expect(tree.read('libs/lib1/bar.ts').toString()).toMatchInlineSnapshot(`
"/* tslint:disable */
eval('');
/* tslint:enable */"
`);

    await readWorkspace(
      await runSchematic(
        'convert-tslint-to-eslint',
        <ConvertTSLintToESLintSchema>{
          project: 'lib1',
        },
        tree
      )
    );

    // After
    expect(tree.read('libs/lib1/foo.ts').toString()).toMatchInlineSnapshot(`
"// eslint-disable-next-line no-eval
eval('');
"
`);
    expect(tree.read('libs/lib1/bar.ts').toString()).toMatchInlineSnapshot(`
"/* eslint-disable */
eval('');
/* eslint-enable */
"
`);
  });
});
