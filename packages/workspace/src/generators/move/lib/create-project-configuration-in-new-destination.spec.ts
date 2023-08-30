import {
  addProjectConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { NormalizedSchema } from '../schema';
import { createProjectConfigurationInNewDestination } from './create-project-configuration-in-new-destination';

describe('moveProjectConfiguration', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;
  let schema: NormalizedSchema;

  beforeEach(() => {
    schema = {
      projectName: 'my-source',
      projectNameAndRootFormat: 'as-provided',
      updateImportPath: false,
      newProjectName: 'subfolder-my-destination',
      relativeToRootDestination: 'subfolder/my-destination',
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
          executor: '@nx/jest:jest',
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
          executor: '@nx/cypress:cypress',
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
    createProjectConfigurationInNewDestination(tree, schema, projectConfig);

    expect(
      readProjectConfiguration(tree, 'subfolder-my-destination')
    ).toBeDefined();
  });

  it('should update paths in only the intended project', async () => {
    createProjectConfigurationInNewDestination(tree, schema, projectConfig);

    const actualProject = readProjectConfiguration(
      tree,
      'subfolder-my-destination'
    );
    expect(actualProject).toBeDefined();
    expect(actualProject.root).toBe('subfolder/my-destination');
    expect(actualProject.sourceRoot).toBe('subfolder/my-destination/src');

    const similarProject = readProjectConfiguration(tree, 'my-source-e2e');
    expect(similarProject).toBeDefined();
    expect(similarProject.root).toBe('apps/my-source-e2e');
  });

  it('should update tags and implicitDependencies', () => {
    createProjectConfigurationInNewDestination(tree, schema, projectConfig);

    const actualProject = readProjectConfiguration(
      tree,
      'subfolder-my-destination'
    );
    expect(actualProject.tags).toEqual(['type:ui']);
    expect(actualProject.implicitDependencies).toEqual(['my-other-lib']);
  });

  it('should support moving a standalone project', () => {
    const projectName = 'standalone';
    const newProjectName = 'parent-standalone';
    addProjectConfiguration(
      tree,
      projectName,
      {
        projectType: 'library',
        root: 'libs/standalone',
        targets: {},
      },
      true
    );
    const moveSchema: NormalizedSchema = {
      projectName: 'standalone',
      importPath: '@proj/parent-standalone',
      newProjectName,
      relativeToRootDestination: 'parent/standalone',
      updateImportPath: true,
    };

    createProjectConfigurationInNewDestination(tree, moveSchema, projectConfig);

    expect(readProjectConfiguration(tree, newProjectName)).toBeDefined();
  });
});
