import {
  expectTestsPass,
  newProject,
  cleanupProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  removeFile,
  checkFilesDoNotExist,
  isNotWindows,
  readJson,
  createFile,
} from '@nrwl/e2e/utils';

describe('Angular Config', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  it('should support workspaces w/o workspace config file', async () => {
    if (isNotWindows()) {
      const oldWorkspaceJson = readJson('workspace.json');
      removeFile('workspace.json');
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --directory=myDir --routing`);

      runCLI(`build my-dir-${myapp} --aot`);
      expectTestsPass(await runCLIAsync(`test my-dir-${myapp} --no-watch`));
      expect(() =>
        checkFilesDoNotExist('workspace.json', 'angular.json')
      ).not.toThrow();
      createFile('workspace.json', JSON.stringify(oldWorkspaceJson, null, 2));
    }
  }, 1000000);

  it('should upgrade the config correctly', async () => {
    const previousCI = process.env.SELECTED_CLI;
    process.env.SELECTED_CLI = 'angular';

    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

    // update the angular.json, first reset to v1 config
    updateFile(`angular.json`, angularV1Json(myapp));
    const workspaceJson = readJson(`angular.json`);
    workspaceJson.version = 2;
    workspaceJson.projects[myapp].targets = updateConfig(
      workspaceJson.projects[myapp].architect
    );
    workspaceJson.generators = workspaceJson.schematics;
    delete workspaceJson.schematics;
    updateFile('angular.json', JSON.stringify(workspaceJson, null, 2));

    const myapp2 = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp2} --no-interactive`);
    expectTestsPass(await runCLIAsync(`test ${myapp2} --no-watch`));

    process.env.SELECTED_CLI = previousCI;
  }, 1000000);
});

function updateConfig(targets: any) {
  const res = {};
  Object.entries(targets).forEach(([name, t]: any) => {
    t.executor = t.builder;
    delete t.builder;
    res[name] = t;
  });
  return res;
}

const angularV1Json = (appName: string) => `{
    "version": 1,
    "projects": {
      "${appName}": {
        "projectType": "application",
        "root": "apps/${appName}",
        "sourceRoot": "apps/${appName}/src",
        "prefix": "v1anuglar",
        "architect": {
          "build": {
            "builder": "@angular-devkit/build-angular:browser",
            "outputs": ["{options.outputPath}"],
            "options": {
              "outputPath": "dist/apps/${appName}",
              "index": "apps/${appName}/src/index.html",
              "main": "apps/${appName}/src/main.ts",
              "polyfills": "apps/${appName}/src/polyfills.ts",
              "tsConfig": "apps/${appName}/tsconfig.app.json",
              "assets": ["apps/${appName}/src/favicon.ico", "apps/${appName}/src/assets"],
              "styles": ["apps/${appName}/src/styles.css"],
              "scripts": []
            },
            "configurations": {
              "production": {
                "budgets": [
                  {
                    "type": "initial",
                    "maximumWarning": "500kb",
                    "maximumError": "1mb"
                  },
                  {
                    "type": "anyComponentStyle",
                    "maximumWarning": "2kb",
                    "maximumError": "4kb"
                  }
                ],
                "fileReplacements": [
                  {
                    "replace": "apps/${appName}/src/environments/environment.ts",
                    "with": "apps/${appName}/src/environments/environment.prod.ts"
                  }
                ],
                "outputHashing": "all"
              },
              "development": {
                "buildOptimizer": false,
                "optimization": false,
                "vendorChunk": true,
                "extractLicenses": false,
                "sourceMap": true,
                "namedChunks": true
              }
            },
            "defaultConfiguration": "production"
          },
          "serve": {
            "builder": "@angular-devkit/build-angular:dev-server",
            "configurations": {
              "production": {
                "browserTarget": "${appName}:build:production"
              },
              "development": {
                "browserTarget": "${appName}:build:development"
              }
            },
            "defaultConfiguration": "development"
          },
          "extract-i18n": {
            "builder": "@angular-devkit/build-angular:extract-i18n",
            "options": {
              "browserTarget": "${appName}:build"
            }
          },
          "lint": {
            "builder": "@nrwl/linter:eslint",
            "options": {
              "lintFilePatterns": [
                "apps/${appName}/src/**/*.ts",
                "apps/${appName}/src/**/*.html"
              ]
            }
          },
          "test": {
            "builder": "@nrwl/jest:jest",
            "outputs": ["coverage/apps/${appName}"],
            "options": {
              "jestConfig": "apps/${appName}/jest.config.ts",
              "passWithNoTests": true
            }
          }
        },
        "tags": []
      },
      "${appName}-e2e": {
        "root": "apps/${appName}-e2e",
        "sourceRoot": "apps/${appName}-e2e/src",
        "projectType": "application",
        "architect": {
          "e2e": {
            "builder": "@nrwl/cypress:cypress",
            "options": {
              "cypressConfig": "apps/${appName}-e2e/cypress.json",
              "devServerTarget": "${appName}:serve:development"
            },
            "configurations": {
              "production": {
                "devServerTarget": "${appName}:serve:production"
              }
            }
          },
          "lint": {
            "builder": "@nrwl/linter:eslint",
            "outputs": ["{options.outputFile}"],
            "options": {
              "lintFilePatterns": ["apps/${appName}-e2e/**/*.{js,ts}"]
            }
          }
        },
        "tags": [],
        "implicitDependencies": ["${appName}"]
      }
    }
  }
  `;
