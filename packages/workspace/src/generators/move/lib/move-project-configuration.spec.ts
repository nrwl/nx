import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { NxJson } from '../../../core/shared-interfaces';
import { Schema } from '../schema';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { moveProjectConfiguration } from '@nrwl/workspace/src/generators/move/lib/move-project-configuration';

describe('moveProjectConfiguration', () => {
  let tree: Tree;
  let projectConfig;
  let schema: Schema;
  beforeEach(async () => {
    schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'my-source', {
      projectType: 'application',
      root: 'apps/my-source',
      sourceRoot: 'apps/my-source/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
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
                  with: 'apps/my-source/src/environments/environment.prod.ts',
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
          executor: '@angular-devkit/build-angular:dev-server',
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
          executor: '@angular-devkit/build-angular:extract-i18n',
          options: {
            browserTarget: 'my-source:build',
          },
        },
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: [
              'apps/my-source/tsconfig.app.json',
              'apps/my-source/tsconfig.spec.json',
            ],
            exclude: ['**/node_modules/**', '!apps/my-source/**/*'],
          },
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/my-source/jest.config.js',
            tsConfig: 'apps/my-source/tsconfig.spec.json',
            setupFile: 'apps/my-source/src/test-setup.ts',
          },
        },
      },
      tags: ['type:ui'],
      implicitDependencies: ['my-other-lib'],
    });

    addProjectConfiguration(tree, 'my-source-e2e', {
      root: 'apps/my-source-e2e',
      sourceRoot: 'apps/my-source-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nrwl/cypress:cypress',
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
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: ['apps/my-source-e2e/tsconfig.e2e.json'],
            exclude: ['**/node_modules/**', '!apps/my-source-e2e/**/*'],
          },
        },
      },
    });

    projectConfig = readProjectConfiguration(tree, 'my-source');
  });
  it('should rename the project', async () => {
    moveProjectConfiguration(tree, schema, projectConfig);

    expect(() => {
      readProjectConfiguration(tree, 'my-source');
    }).toThrow();

    expect(
      readProjectConfiguration(tree, 'subfolder-my-destination')
    ).toBeDefined();
  });

  it('should update paths in only the intended project', async () => {
    moveProjectConfiguration(tree, schema, projectConfig);

    const actualProject = readProjectConfiguration(
      tree,
      'subfolder-my-destination'
    );
    expect(actualProject).toBeDefined();
    expect(actualProject.root).toBe('apps/subfolder/my-destination');
    expect(actualProject.root).toBe('apps/subfolder/my-destination');

    const similarProject = readProjectConfiguration(tree, 'my-source-e2e');
    expect(similarProject).toBeDefined();
    expect(similarProject.root).toBe('apps/my-source-e2e');
  });

  it('honor custom workspace layouts', async () => {
    updateJson<NxJson>(tree, 'nx.json', (json) => {
      json.workspaceLayout = { appsDir: 'e2e', libsDir: 'packages' };
      return json;
    });

    moveProjectConfiguration(tree, schema, projectConfig);

    const project = readProjectConfiguration(tree, 'subfolder-my-destination');
    expect(project).toBeDefined();
    expect(project.root).toBe('e2e/subfolder/my-destination');
    expect(project.sourceRoot).toBe('e2e/subfolder/my-destination/src');
  });

  it('should update nx.json', () => {
    moveProjectConfiguration(tree, schema, projectConfig);

    const actualProject = readProjectConfiguration(
      tree,
      'subfolder-my-destination'
    );

    expect(actualProject.tags).toEqual(['type:ui']);
    expect(actualProject.implicitDependencies).toEqual(['my-other-lib']);

    expect(readJson(tree, 'nx.json').projects['my-source']).not.toBeDefined();
  });
});
