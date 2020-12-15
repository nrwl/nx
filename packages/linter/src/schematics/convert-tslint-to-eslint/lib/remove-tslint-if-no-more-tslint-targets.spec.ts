import { chain, Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  readWorkspace,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { removeTSLintIfNoMoreTSLintTargets } from './remove-tslint-if-no-more-tslint-targets';

jest.mock('@angular-devkit/schematics/tasks', () => ({
  NodePackageInstallTask: jest.fn().mockImplementation(() => {
    return {
      toConfiguration() {
        return {
          name: 'node-package',
        };
      },
    };
  }),
}));

const { NodePackageInstallTask } = require('@angular-devkit/schematics/tasks');

describe('removeTSLintIfNoMoreTSLintTargets()', () => {
  let tree: Tree;

  beforeEach(async () => {
    jest.clearAllMocks();

    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      chain([
        updateJsonInTree('package.json', () => {
          return {
            devDependencies: {
              codelyzer: '*',
              tslint: '*',
            },
          };
        }),
        updateJsonInTree('tslint.json', () => {
          return {};
        }),
        updateWorkspaceInTree(() => {
          return {
            version: 1,
            projects: {
              ngappone: {
                projectType: 'application',
                root: 'apps/ngappone',
                sourceRoot: 'apps/ngappone/src',
                prefix: 'v13819',
                architect: {
                  build: {
                    builder: '@angular-devkit/build-angular:browser',
                    options: {
                      outputPath: 'dist/apps/ngappone',
                      index: 'apps/ngappone/src/index.html',
                      main: 'apps/ngappone/src/main.ts',
                      polyfills: 'apps/ngappone/src/polyfills.ts',
                      tsConfig: 'apps/ngappone/tsconfig.app.json',
                      aot: true,
                      assets: [
                        'apps/ngappone/src/favicon.ico',
                        'apps/ngappone/src/assets',
                      ],
                      styles: ['apps/ngappone/src/styles.css'],
                      scripts: [],
                    },
                    configurations: {
                      production: {
                        fileReplacements: [
                          {
                            replace:
                              'apps/ngappone/src/environments/environment.ts',
                            with:
                              'apps/ngappone/src/environments/environment.prod.ts',
                          },
                        ],
                        optimization: true,
                        outputHashing: 'all',
                        sourceMap: false,
                        namedChunks: false,
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
                      browserTarget: 'ngappone:build',
                    },
                    configurations: {
                      production: {
                        browserTarget: 'ngappone:build:production',
                      },
                    },
                  },
                  'extract-i18n': {
                    builder: '@angular-devkit/build-angular:extract-i18n',
                    options: {
                      browserTarget: 'ngappone:build',
                    },
                  },
                  lint: {
                    builder: '@nrwl/linter:eslint',
                    options: {
                      lintFilePatterns: [
                        'apps/ngappone/src/**/*.ts',
                        'apps/ngappone/src/**/*.html',
                      ],
                    },
                  },
                  test: {
                    builder: '@nrwl/jest:jest',
                    outputs: ['coverage/apps/ngappone'],
                    options: {
                      jestConfig: 'apps/ngappone/jest.config.js',
                      passWithNoTests: true,
                    },
                  },
                },
              },
              'ngappone-e2e': {
                root: 'apps/ngappone-e2e',
                sourceRoot: 'apps/ngappone-e2e/src',
                projectType: 'application',
                architect: {
                  e2e: {
                    builder: '@nrwl/cypress:cypress',
                    options: {
                      cypressConfig: 'apps/ngappone-e2e/cypress.json',
                      tsConfig: 'apps/ngappone-e2e/tsconfig.e2e.json',
                      devServerTarget: 'ngappone:serve',
                    },
                    configurations: {
                      production: {
                        devServerTarget: 'ngappone:serve:production',
                      },
                    },
                  },
                  lint: {
                    builder: '@nrwl/linter:eslint',
                    options: {
                      lintFilePatterns: [
                        'apps/ngappone-e2e/src/**/*.ts',
                        'apps/ngappone-e2e/src/**/*.html',
                      ],
                    },
                  },
                },
              },
              foo: {
                root: 'apps/foo',
                sourceRoot: 'apps/foo/src',
                projectType: 'application',
                prefix: 'foo',
                architect: {
                  build: {
                    builder: '@nrwl/node:build',
                    outputs: ['{options.outputPath}'],
                    options: {
                      outputPath: 'dist/apps/foo',
                      main: 'apps/foo/src/main.ts',
                      tsConfig: 'apps/foo/tsconfig.app.json',
                      assets: ['apps/foo/src/assets'],
                    },
                    configurations: {
                      production: {
                        optimization: true,
                        extractLicenses: true,
                        inspect: false,
                        fileReplacements: [
                          {
                            replace: 'apps/foo/src/environments/environment.ts',
                            with:
                              'apps/foo/src/environments/environment.prod.ts',
                          },
                        ],
                      },
                    },
                  },
                  serve: {
                    builder: '@nrwl/node:execute',
                    options: {
                      buildTarget: 'foo:build',
                    },
                  },
                  lint: {
                    builder: '@nrwl/linter:eslint',
                    options: {
                      lintFilePatterns: [
                        'apps/foo/src/**/*.ts',
                        'apps/foo/src/**/*.html',
                      ],
                    },
                  },
                  test: {
                    builder: '@nrwl/jest:jest',
                    outputs: ['coverage/apps/foo'],
                    options: {
                      jestConfig: 'apps/foo/jest.config.js',
                      passWithNoTests: true,
                    },
                  },
                },
              },
              nodey: {
                root: 'apps/nodey',
                sourceRoot: 'apps/nodey/src',
                projectType: 'application',
                prefix: 'nodey',
                architect: {
                  build: {
                    builder: '@nrwl/node:build',
                    outputs: ['{options.outputPath}'],
                    options: {
                      outputPath: 'dist/apps/nodey',
                      main: 'apps/nodey/src/main.ts',
                      tsConfig: 'apps/nodey/tsconfig.app.json',
                      assets: ['apps/nodey/src/assets'],
                    },
                    configurations: {
                      production: {
                        optimization: true,
                        extractLicenses: true,
                        inspect: false,
                        fileReplacements: [
                          {
                            replace:
                              'apps/nodey/src/environments/environment.ts',
                            with:
                              'apps/nodey/src/environments/environment.prod.ts',
                          },
                        ],
                      },
                    },
                  },
                  serve: {
                    builder: '@nrwl/node:execute',
                    options: {
                      buildTarget: 'nodey:build',
                    },
                  },
                  lint: {
                    builder: '@nrwl/linter:eslint',
                    options: {
                      lintFilePatterns: ['apps/nodey/**/*.ts'],
                    },
                  },
                  test: {
                    builder: '@nrwl/jest:jest',
                    outputs: ['coverage/apps/nodey'],
                    options: {
                      jestConfig: 'apps/nodey/jest.config.js',
                      passWithNoTests: true,
                    },
                  },
                },
              },
            },
            cli: {
              defaultCollection: '@nrwl/angular',
            },
            schematics: {
              '@nrwl/workspace': {
                library: {
                  linter: 'tslint',
                },
              },
              '@nrwl/cypress': {
                'cypress-project': {
                  linter: 'tslint',
                },
              },
              '@nrwl/node': {
                application: {
                  linter: 'tslint',
                },
                library: {
                  linter: 'tslint',
                },
              },
              '@nrwl/nest': {
                application: {
                  linter: 'tslint',
                },
                library: {
                  linter: 'tslint',
                },
              },
              '@nrwl/express': {
                application: {
                  linter: 'tslint',
                },
                library: {
                  linter: 'tslint',
                },
              },
              '@nrwl/angular:application': {
                unitTestRunner: 'jest',
                e2eTestRunner: 'cypress',
              },
              '@nrwl/angular:library': {
                unitTestRunner: 'jest',
              },
              '@nrwl/angular:component': {
                style: 'css',
              },
            },
            defaultProject: 'ngappone',
          };
        }),
      ]),
      tree
    );
  });

  it('should remove TSlint and Codelyzer from the package.json', async () => {
    expect(readJsonInTree(tree, 'package.json')).toEqual({
      devDependencies: {
        codelyzer: '*',
        tslint: '*',
      },
    });

    await callRule(removeTSLintIfNoMoreTSLintTargets('tslint.json'), tree);

    expect(readJsonInTree(tree, 'package.json')).toEqual({
      devDependencies: {},
    });
  });

  it('should call NodePackageInstallTask in order to remove the dependencies from the workspace', async () => {
    await callRule(removeTSLintIfNoMoreTSLintTargets('tslint.json'), tree);

    expect(NodePackageInstallTask).toHaveBeenCalled();
  });

  it('should delete the root tslint.json', async () => {
    expect(tree.exists('tslint.json')).toBe(true);

    await callRule(removeTSLintIfNoMoreTSLintTargets('tslint.json'), tree);

    expect(tree.exists('tslint.json')).toBe(false);
  });

  it('should update the schematics configuration within the workspace JSON to use eslint instead of tslint', async () => {
    expect(readWorkspace(tree).schematics).toMatchInlineSnapshot(`
      Object {
        "@nrwl/angular:application": Object {
          "e2eTestRunner": "cypress",
          "unitTestRunner": "jest",
        },
        "@nrwl/angular:component": Object {
          "style": "css",
        },
        "@nrwl/angular:library": Object {
          "unitTestRunner": "jest",
        },
        "@nrwl/cypress": Object {
          "cypress-project": Object {
            "linter": "tslint",
          },
        },
        "@nrwl/express": Object {
          "application": Object {
            "linter": "tslint",
          },
          "library": Object {
            "linter": "tslint",
          },
        },
        "@nrwl/nest": Object {
          "application": Object {
            "linter": "tslint",
          },
          "library": Object {
            "linter": "tslint",
          },
        },
        "@nrwl/node": Object {
          "application": Object {
            "linter": "tslint",
          },
          "library": Object {
            "linter": "tslint",
          },
        },
        "@nrwl/workspace": Object {
          "library": Object {
            "linter": "tslint",
          },
        },
      }
    `);

    await callRule(removeTSLintIfNoMoreTSLintTargets('tslint.json'), tree);

    expect(readWorkspace(tree).schematics).toMatchInlineSnapshot(`
      Object {
        "@nrwl/angular:application": Object {
          "e2eTestRunner": "cypress",
          "linter": "eslint",
          "unitTestRunner": "jest",
        },
        "@nrwl/angular:component": Object {
          "style": "css",
        },
        "@nrwl/angular:library": Object {
          "linter": "eslint",
          "unitTestRunner": "jest",
        },
        "@nrwl/cypress": Object {
          "cypress-project": Object {
            "linter": "eslint",
          },
        },
        "@nrwl/express": Object {
          "application": Object {
            "linter": "eslint",
          },
          "library": Object {
            "linter": "eslint",
          },
        },
        "@nrwl/nest": Object {
          "application": Object {
            "linter": "eslint",
          },
          "library": Object {
            "linter": "eslint",
          },
        },
        "@nrwl/node": Object {
          "application": Object {
            "linter": "eslint",
          },
          "library": Object {
            "linter": "eslint",
          },
        },
        "@nrwl/workspace": Object {
          "library": Object {
            "linter": "eslint",
          },
        },
      }
    `);
  });
});
