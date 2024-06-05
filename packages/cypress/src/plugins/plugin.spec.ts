import { CreateNodesContext } from '@nx/devkit';
import { defineConfig } from 'cypress';

import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { resetWorkspaceContext } from 'nx/src/utils/workspace-context';
import { join } from 'path';
import { nxE2EPreset } from '../../plugins/cypress-preset';

describe('@nx/cypress/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('cypress-plugin');

    await tempFs.createFiles({
      'package.json': '{}',
      'cypress.config.js': '',
      'src/test.cy.ts': '',
    });
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
      configFiles: [],
    };
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
  });

  afterAll(() => {
    resetWorkspaceContext();
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
      ['cypress.config.js'],
      {
        targetName: 'e2e',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "cypress.config.js",
          {
            "projects": {
              ".": {
                "metadata": undefined,
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
                    "metadata": {
                      "description": "Runs Cypress Tests",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
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
      ['cypress.config.js'],
      {
        componentTestingTargetName: 'component-test',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "cypress.config.js",
          {
            "projects": {
              ".": {
                "metadata": undefined,
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
                    "metadata": {
                      "description": "Runs Cypress Component Tests",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should use ciDevServerTarget to create additional configurations', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          ...nxE2EPreset(join(tempFs.tempDir, 'cypress.config.js'), {
            webServerCommands: {
              default: 'my-app:serve',
              production: 'my-app:serve:production',
            },
            ciWebServerCommand: 'my-app:serve-static',
          }),
          specPattern: '**/*.cy.ts',
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
        },
      })
    );
    const nodes = await createNodesFunction(
      ['cypress.config.js'],
      {
        componentTestingTargetName: 'component-test',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "cypress.config.js",
          {
            "projects": {
              ".": {
                "metadata": {
                  "targetGroups": {
                    "E2E (CI)": [
                      "e2e-ci--src/test.cy.ts",
                      "e2e-ci",
                    ],
                  },
                },
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
                    "metadata": {
                      "description": "Runs Cypress Tests",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
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
                    "metadata": {
                      "description": "Runs Cypress Tests in CI",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
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
                    "metadata": {
                      "description": "Runs Cypress Tests in src/test.cy.ts in CI",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  function mockCypressConfig(cypressConfig: Cypress.ConfigOptions) {
    // This isn't JS, but all that really matters here
    // is that the hash is different after updating the
    // config file. The actual config read is mocked below.
    tempFs.createFileSync('cypress.config.js', JSON.stringify(cypressConfig));
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
