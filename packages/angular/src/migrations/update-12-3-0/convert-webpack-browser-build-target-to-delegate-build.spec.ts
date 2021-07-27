import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import convertWebpackBrowserBuildTargetToDelegateBuild from './convert-webpack-browser-build-target-to-delegate-build';

function getWsConfig(tree: Tree) {
  return readJson(tree, 'workspace.json');
}

describe('convertWebpackBrowserBuildTargetToDelegateBuild', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'ng-app1', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        customBuild: {
          executor: '@angular-devkit/build-angular:browser',
        },
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            buildTarget: 'ng-app:customBuild',
            outputPath: 'dist/apps/ng-app1',
            tsConfig: 'apps/ng-app1/tsconfig.app.json',
            index: 'apps/ng-app1/src/index.html',
            main: 'apps/ng-app1/src/main.ts',
            polyfills: 'apps/ng-app1/src/polyfills.ts',
            inlineStyleLanguage: 'scss',
            assets: ['apps/ng-app1/src/favicon.ico', 'apps/ng-app1/src/assets'],
            styles: ['apps/ng-app1/src/styles.scss'],
            scripts: [],
          },
          configurations: {
            production: {
              budgets: [
                {
                  type: 'initial',
                  maximumWarning: '500kb',
                  maximumError: '1mb',
                },
                {
                  type: 'anyComponentStyle',
                  maximumWarning: '2kb',
                  maximumError: '4kb',
                },
              ],
              fileReplacements: [
                {
                  replace: 'apps/ng-app1/src/environments/environment.ts',
                  with: 'apps/ng-app1/src/environments/environment.prod.ts',
                },
              ],
              outputHashing: 'all',
            },
            development: {
              buildOptimizer: false,
              optimization: false,
              vendorChunk: true,
              extractLicenses: false,
              sourceMap: true,
              namedChunks: true,
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });

    addProjectConfiguration(tree, 'ng-app2', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        customBuild: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/ng-app2',
            tsConfig: 'apps/ng-app2/tsconfig.app.json',
            index: 'apps/ng-app2/src/index.html',
            main: 'apps/ng-app2/src/different-main.ts',
            additionalProperty: 'foo',
          },
          configurations: {
            development: {
              buildOptimizer: true,
            },
            production: {
              additionalProperty: 'bar',
              fileReplacements: [
                {
                  replace: 'apps/ng-app2/src/environments/environment.ts',
                  with: 'apps/ng-app2/src/environments/environment.other.ts',
                },
              ],
            },
          },
        },
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            outputPath: 'dist/apps/ng-app2',
            tsConfig: 'apps/ng-app2/tsconfig.app.json',
            index: 'apps/ng-app2/src/index.html',
            main: 'apps/ng-app2/src/main.ts',
            polyfills: 'apps/ng-app2/src/polyfills.ts',
            inlineStyleLanguage: 'scss',
            assets: ['apps/ng-app2/src/favicon.ico', 'apps/ng-app2/src/assets'],
            styles: ['apps/ng-app2/src/styles.scss'],
            scripts: [],
          },
          configurations: {
            production: {
              buildTarget: 'ng-app:customBuild:production',
              budgets: [
                {
                  type: 'initial',
                  maximumWarning: '500kb',
                  maximumError: '1mb',
                },
                {
                  type: 'anyComponentStyle',
                  maximumWarning: '2kb',
                  maximumError: '4kb',
                },
              ],
              fileReplacements: [
                {
                  replace: 'apps/ng-app2/src/environments/environment.ts',
                  with: 'apps/ng-app2/src/environments/environment.prod.ts',
                },
              ],
              outputHashing: 'all',
            },
            development: {
              buildTarget: 'ng-app:customBuild:development',
              buildOptimizer: false,
              optimization: false,
              vendorChunk: true,
              extractLicenses: false,
              sourceMap: true,
              namedChunks: true,
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });

    addProjectConfiguration(tree, 'ng-app3', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            outputPath: 'dist/apps/ng-app3',
            tsConfig: 'apps/ng-app3/tsconfig.app.json',
            index: 'apps/ng-app3/src/index.html',
            main: 'apps/ng-app3/src/main.ts',
            polyfills: 'apps/ng-app3/src/polyfills.ts',
            inlineStyleLanguage: 'scss',
            assets: ['apps/ng-app3/src/favicon.ico', 'apps/ng-app3/src/assets'],
            styles: ['apps/ng-app3/src/styles.scss'],
            scripts: [],
          },
          configurations: {
            production: {
              budgets: [
                {
                  type: 'initial',
                  maximumWarning: '500kb',
                  maximumError: '1mb',
                },
                {
                  type: 'anyComponentStyle',
                  maximumWarning: '2kb',
                  maximumError: '4kb',
                },
              ],
              fileReplacements: [
                {
                  replace: 'apps/ng-app3/src/environments/environment.ts',
                  with: 'apps/ng-app3/src/environments/environment.prod.ts',
                },
              ],
              outputHashing: 'all',
            },
            development: {
              buildOptimizer: false,
              optimization: false,
              vendorChunk: true,
              extractLicenses: false,
              sourceMap: true,
              namedChunks: true,
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });
  });

  it('should update the configuration correctly', async () => {
    await convertWebpackBrowserBuildTargetToDelegateBuild(tree);

    expect(getWsConfig(tree)).toMatchSnapshot();
  });
});
