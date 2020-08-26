import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { NxJson, updateJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateWorkspace } from './update-workspace';

describe('updateWorkspace Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    const workspace = {
      version: 1,
      projects: {
        'my-source': {
          projectType: 'application',
          root: 'apps/my-source',
          sourceRoot: 'apps/my-source/src',
          prefix: 'app',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/my-source',
                index: 'apps/my-source/src/index.html',
                main: 'apps/my-source/src/main.ts',
                polyfills: 'apps/my-source/src/polyfills.ts',
                tsConfig: 'apps/my-source/tsconfig.app.json',
                aot: false,
                assets: [
                  'apps/my-source/src/favicon.ico',
                  'apps/my-source/src/assets',
                ],
                styles: ['apps/my-source/src/styles.scss'],
                scripts: [],
              },
              configurations: {
                production: {
                  fileReplacements: [
                    {
                      replace: 'apps/my-source/src/environments/environment.ts',
                      with:
                        'apps/my-source/src/environments/environment.prod.ts',
                    },
                  ],
                  optimization: true,
                  outputHashing: 'all',
                  sourceMap: false,
                  extractCss: true,
                  namedChunks: false,
                  aot: true,
                  extractLicenses: true,
                  vendorChunk: false,
                  buildOptimizer: true,
                  budgets: [
                    {
                      type: 'initial',
                      maximumWarning: '2mb',
                      maximumError: '5mb',
                    },
                    {
                      type: 'anyComponentStyle',
                      maximumWarning: '6kb',
                      maximumError: '10kb',
                    },
                  ],
                },
              },
            },
            serve: {
              builder: '@angular-devkit/build-angular:dev-server',
              options: {
                browserTarget: 'my-source:build',
              },
              configurations: {
                production: {
                  browserTarget: 'my-source:build:production',
                },
              },
            },
            'extract-i18n': {
              builder: '@angular-devkit/build-angular:extract-i18n',
              options: {
                browserTarget: 'my-source:build',
              },
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'apps/my-source/tsconfig.app.json',
                  'apps/my-source/tsconfig.spec.json',
                ],
                exclude: ['**/node_modules/**', '!apps/my-source/**/*'],
              },
            },
            test: {
              builder: '@nrwl/jest:jest',
              options: {
                jestConfig: 'apps/my-source/jest.config.js',
                tsConfig: 'apps/my-source/tsconfig.spec.json',
                setupFile: 'apps/my-source/src/test-setup.ts',
              },
            },
          },
        },
        'my-source-e2e': {
          root: 'apps/my-source-e2e',
          sourceRoot: 'apps/my-source-e2e/src',
          projectType: 'application',
          architect: {
            e2e: {
              builder: '@nrwl/cypress:cypress',
              options: {
                cypressConfig: 'apps/my-source-e2e/cypress.json',
                tsConfig: 'apps/my-source-e2e/tsconfig.e2e.json',
                devServerTarget: 'my-source:serve',
              },
              configurations: {
                production: {
                  devServerTarget: 'my-source:serve:production',
                },
              },
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: ['apps/my-source-e2e/tsconfig.e2e.json'],
                exclude: ['**/node_modules/**', '!apps/my-source-e2e/**/*'],
              },
            },
          },
        },
      },
      defaultProject: 'my-source',
    };

    tree.overwrite('workspace.json', JSON.stringify(workspace));
  });

  it('should rename the project', async () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
    };

    tree = (await callRule(updateWorkspace(schema), tree)) as UnitTestTree;

    const workspace = JSON.parse(tree.read('workspace.json').toString());

    expect(workspace.projects['my-source']).toBeUndefined();
    expect(workspace.projects['subfolder-my-destination']).toBeDefined();
  });

  it('should update the default project', async () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
    };

    tree = (await callRule(updateWorkspace(schema), tree)) as UnitTestTree;

    const workspace = JSON.parse(tree.read('workspace.json').toString());

    expect(workspace.defaultProject).toBe('subfolder-my-destination');
  });

  it('should update paths in only the intended project', async () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
    };

    tree = (await callRule(updateWorkspace(schema), tree)) as UnitTestTree;

    const workspace = JSON.parse(tree.read('workspace.json').toString());

    const actualProject = workspace.projects['subfolder-my-destination'];
    expect(actualProject).toBeDefined();
    expect(actualProject.root).toBe('apps/subfolder/my-destination');
    expect(actualProject.root).toBe('apps/subfolder/my-destination');

    const similarProject = workspace.projects['my-source-e2e'];
    expect(similarProject).toBeDefined();
    expect(similarProject.root).toBe('apps/my-source-e2e');
  });

  it('should update build targets', async () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
    };

    tree = (await callRule(updateWorkspace(schema), tree)) as UnitTestTree;

    const workspace = JSON.parse(tree.read('workspace.json').toString());

    const e2eProject = workspace.projects['my-source-e2e'];
    expect(e2eProject).toBeDefined();
    expect(e2eProject.architect.e2e.options.devServerTarget).toBe(
      'subfolder-my-destination:serve'
    );
    expect(
      e2eProject.architect.e2e.configurations.production.devServerTarget
    ).toBe('subfolder-my-destination:serve:production');
  });

  it('honor custom workspace layouts', async () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
    };

    tree = (await callRule(
      updateJsonInTree<NxJson>('nx.json', (json) => {
        json.workspaceLayout = { appsDir: 'e2e', libsDir: 'packages' };
        return json;
      }),
      tree
    )) as UnitTestTree;

    tree = (await callRule(updateWorkspace(schema), tree)) as UnitTestTree;

    const workspace = JSON.parse(tree.read('workspace.json').toString());

    const project = workspace.projects['subfolder-my-destination'];
    expect(project).toBeDefined();
    expect(project.root).toBe('e2e/subfolder/my-destination');
    expect(project.sourceRoot).toBe('e2e/subfolder/my-destination/src');
  });
});
