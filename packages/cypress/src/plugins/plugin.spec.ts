import { CreateNodesContext } from '@nx/devkit';
import { defineConfig } from 'cypress';

import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';

describe('@nx/cypress/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('cypress-plugin');

    await tempFs.createFiles({
      'package.json': '{}',
      'test.cy.ts': '',
    });
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  it('should add a target for e2e', () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
        },
      })
    );
    const nodes = createNodesFunction(
      'cypress.config.js',
      {
        targetName: 'e2e',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "application",
            "targets": {
              "e2e": {
                "cache": true,
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "testingType": "e2e",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                  "{projectRoot}/dist/videos",
                  "{projectRoot}/dist/screenshots",
                ],
              },
            },
          },
        },
      }
    `);
  });

  it('should add a target for component testing', () => {
    mockCypressConfig(
      defineConfig({
        component: {
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
          devServer: {
            framework: 'create-react-app',
            bundler: 'webpack',
          },
        },
      })
    );
    const nodes = createNodesFunction(
      'cypress.config.js',
      {
        componentTestingTargetName: 'component-test',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "application",
            "targets": {
              "component-test": {
                "cache": true,
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "testingType": "component",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                  "{projectRoot}/dist/videos",
                  "{projectRoot}/dist/screenshots",
                ],
              },
            },
          },
        },
      }
    `);
  });

  it('should use ciDevServerTarget to create additional configurations', () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          specPattern: '**/*.cy.ts',
          env: {
            devServerTargets: {
              default: 'my-app:serve',
              production: 'my-app:serve:production',
            },
            ciDevServerTarget: 'my-app:serve-static',
          },
        },
      })
    );
    const nodes = createNodesFunction(
      'cypress.config.js',
      {
        componentTestingTargetName: 'component-test',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "application",
            "targets": {
              "e2e": {
                "cache": true,
                "configurations": {
                  "production": {
                    "devServerTarget": "my-app:serve:production",
                  },
                },
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "devServerTarget": "my-app:serve",
                  "testingType": "e2e",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                ],
              },
              "e2e-ci": {
                "cache": true,
                "dependsOn": [
                  {
                    "params": "forward",
                    "projects": "self",
                    "target": "e2e-ci--test.cy.ts",
                  },
                ],
                "executor": "nx:noop",
                "inputs": [
                  "default",
                  "^production",
                ],
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                ],
              },
              "e2e-ci--test.cy.ts": {
                "cache": true,
                "configurations": undefined,
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "devServerTarget": "my-app:serve-static",
                  "spec": "test.cy.ts",
                  "testingType": "e2e",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                ],
              },
            },
          },
        },
      }
    `);
  });

  function mockCypressConfig(cypressConfig: Cypress.ConfigOptions) {
    jest.mock(
      join(tempFs.tempDir, 'cypress.config.js'),
      () => ({
        default: cypressConfig,
      }),
      {
        virtual: true,
      }
    );
  }
});
