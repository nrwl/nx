import {
  checkFilesExist,
  cleanupProject,
  newProject,
  removeFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('angular.json v1 config', () => {
  const app1 = uniq('app1');

  beforeAll(() => {
    newProject({ packages: ['@nx/angular'] });
    runCLI(
      `generate @nx/angular:app ${app1} --project-name-and-root-format=as-provided --no-interactive`
    );
    // reset workspace to use v1 config
    updateFile(`angular.json`, angularV1Json(app1));
    removeFile(`${app1}/project.json`);
    removeFile(`${app1}-e2e/project.json`);
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
    runCLI(
      `generate @nx/angular:app ${app2} --project-name-and-root-format=as-provided --no-interactive`
    );

    // should generate project.json for new projects
    checkFilesExist(`${app2}/project.json`);
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
      "root": "${appName}",
      "sourceRoot": "${appName}/src",
      "prefix": "v1angular",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "outputs": ["{options.outputPath}"],
          "options": {
            "outputPath": "dist${appName}",
            "index": "${appName}/src/index.html",
            "main": "${appName}/src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "${appName}/tsconfig.app.json",
            "assets": ["${appName}/src/favicon.ico", "${appName}/src/assets"],
            "styles": ["${appName}/src/styles.css"],
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
          "builder": "@nx/eslint:lint"
        },
        "test": {
          "builder": "@nx/jest:jest",
          "outputs": ["{workspaceRoot}/coverage${appName}"],
          "options": {
            "jestConfig": "${appName}/jest.config.ts",
            "passWithNoTests": true
          }
        }
      },
      "tags": []
    },
    "${appName}-e2e": {
      "root": "${appName}-e2e",
      "sourceRoot": "${appName}-e2e/src",
      "projectType": "application",
      "architect": {
        "e2e": {
          "builder": "@nx/cypress:cypress",
          "options": {
            "cypressConfig": "${appName}-e2e/cypress.json",
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
          "builder": "@nx/eslint:lint",
          "outputs": ["{options.outputFile}"]
        }
      },
      "tags": [],
      "implicitDependencies": ["${appName}"]
    }
  }
}
`;
