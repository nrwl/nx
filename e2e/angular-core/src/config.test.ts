import {
  checkFilesExist,
  cleanupProject,
  newProject,
  removeFile,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('angular.json v1 config', () => {
  const app1 = uniq('app1');

  beforeAll(() => {
    newProject();
    runCLI(`generate @nrwl/angular:app ${app1} --no-interactive`);
    // reset workspace to use v1 config
    updateFile(`angular.json`, angularV1Json(app1));
    removeFile(`apps/${app1}/project.json`);
    removeFile(`apps/${app1}-e2e/project.json`);
  });
  afterAll(() => cleanupProject());

  it('should support projects in angular.json v1 config', async () => {
    expect(runCLI(`build ${app1}`)).toContain('Successfully ran target build');
    expect(runCLI(`test ${app1} --no-watch`)).toContain(
      'Successfully ran target test'
    );
  }, 1000000);

  it('should generate new app with project.json and keep the existing in angular.json', async () => {
    // create new app
    const app2 = uniq('app2');
    runCLI(`generate @nrwl/angular:app ${app2} --no-interactive`);

    // should generate project.json for new projects
    checkFilesExist(`apps/${app2}/project.json`);
    // check it works correctly
    expect(runCLI(`build ${app2}`)).toContain('Successfully ran target build');
    expect(runCLI(`test ${app2} --no-watch`)).toContain(
      'Successfully ran target test'
    );
    // check existing app in angular.json still works
    expect(runCLI(`build ${app1}`)).toContain('Successfully ran target build');
    expect(runCLI(`test ${app1} --no-watch`)).toContain(
      'Successfully ran target test'
    );
  }, 1000000);
});

const angularV1Json = (appName: string) => `{
  "version": 1,
  "projects": {
    "${appName}": {
      "projectType": "application",
      "root": "apps/${appName}",
      "sourceRoot": "apps/${appName}/src",
      "prefix": "v1angular",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "outputs": ["{options.outputPath}"],
          "options": {
            "outputPath": "dist/apps/${appName}",
            "index": "apps/${appName}/src/index.html",
            "main": "apps/${appName}/src/main.ts",
            "polyfills": ["zone.js"],
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
            "devServerTarget": "${appName}:serve:development",
            "testingType": "e2e"
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
