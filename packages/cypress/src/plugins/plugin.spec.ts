import { CreateNodesContext } from '@nx/devkit';
import { defineConfig } from 'cypress';

import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';
import { nxE2EPreset } from '../../plugins/cypress-preset';

describe('@nx/cypress/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('cypress-plugin');

    await tempFs.createFiles({
      'package.json': '{}',
      'src/test.cy.ts': '',
    });
    process.chdir(tempFs.tempDir);
    context = {
      nxJsonConfiguration: {
        // These defaults should be overridden by plugin
        targetDefaults: {
          e2e: {
            cache: false,
            inputs: ['foo', '^foo'],
          },
        },
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

  it('should add a target for e2e', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          ...nxE2EPreset('.', {
            webServerCommands: {
              default: 'nx run my-app:serve',
              production: 'nx run my-app:serve:production',
            },
          }),
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
        },
      })
    );
    const nodes = await createNodesFunction(
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
                "command": "cypress run",
                "configurations": {
                  "production": {
                    "command": "cypress run --env webServerCommand="nx run my-app:serve:production"",
                  },
                },
                "inputs": [
                  "default",
                  "^production",
                  {
                    "externalDependencies": [
                      "cypress",
                    ],
                  },
                ],
                "options": {
                  "cwd": ".",
                },
                "outputs": [
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

  it('should add a target for component testing', async () => {
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
    const nodes = await createNodesFunction(
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
                "command": "cypress run --component",
                "inputs": [
                  "default",
                  "^production",
                  {
                    "externalDependencies": [
                      "cypress",
                    ],
                  },
                ],
                "options": {
                  "cwd": ".",
                },
                "outputs": [
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

  it('should use ciDevServerTarget to create additional configurations', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          specPattern: '**/*.cy.ts',
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
          ...nxE2EPreset('.', {
            webServerCommands: {
              default: 'my-app:serve',
              production: 'my-app:serve:production',
            },
            ciWebServerCommand: 'my-app:serve-static',
          }),
        },
      })
    );
    const nodes = await createNodesFunction(
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
                "command": "cypress run",
                "configurations": {
                  "production": {
                    "command": "cypress run --env webServerCommand="my-app:serve:production"",
                  },
                },
                "inputs": [
                  "default",
                  "^production",
                  {
                    "externalDependencies": [
                      "cypress",
                    ],
                  },
                ],
                "options": {
                  "cwd": ".",
                },
                "outputs": [
                  "{projectRoot}/dist/cypress/videos",
                  "{projectRoot}/dist/cypress/screenshots",
                ],
              },
              "e2e-ci": {
                "cache": true,
                "dependsOn": [
                  {
                    "params": "forward",
                    "projects": "self",
                    "target": "e2e-ci--src/test.cy.ts",
                  },
                ],
                "executor": "nx:noop",
                "inputs": [
                  "default",
                  "^production",
                  {
                    "externalDependencies": [
                      "cypress",
                    ],
                  },
                ],
                "outputs": [
                  "{projectRoot}/dist/cypress/videos",
                  "{projectRoot}/dist/cypress/screenshots",
                ],
              },
              "e2e-ci--src/test.cy.ts": {
                "cache": true,
                "command": "cypress run --env webServerCommand="my-app:serve-static" --spec src/test.cy.ts",
                "inputs": [
                  "default",
                  "^production",
                  {
                    "externalDependencies": [
                      "cypress",
                    ],
                  },
                ],
                "options": {
                  "cwd": ".",
                },
                "outputs": [
                  "{projectRoot}/dist/cypress/videos",
                  "{projectRoot}/dist/cypress/screenshots",
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
