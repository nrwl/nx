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
  let cwd = process.cwd();
  let originalCacheProjectGraph: string | undefined;

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

    process.chdir(tempFs.tempDir);
    originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
    process.chdir(cwd);
    process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
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
                    "dependsOn": [
                      {
                        "projects": [
                          "my-app",
                        ],
                        "target": "serve",
                      },
                    ],
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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
                      "help": {
                        "command": "npx --ignore-scripts cypress open --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--e2e",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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
            framework: 'react',
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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
                      "help": {
                        "command": "npx --ignore-scripts cypress open --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--e2e",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                    "parallelism": false,
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "nonAtomizedTarget": "e2e",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci--src/test.cy.ts": {
                    "cache": true,
                    "command": "cypress run --env webServerCommand="my-app:serve-static" --spec src/test.cy.ts --config="{\\"e2e\\":{\\"videosFolder\\":\\"dist/videos/src-test-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-cy-ts\\"}}"",
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos/src-test-cy-ts",
                      "{projectRoot}/dist/screenshots/src-test-cy-ts",
                    ],
                    "parallelism": false,
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "help": {
                        "command": "npx --ignore-scripts cypress open --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--e2e",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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

  it('should infer dependsOn using the task run in the webServerCommands.default and ciWebServerCommand for the e2e and atomized e2e-ci targets respectively and not set parallelism to false', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          ...nxE2EPreset(join(tempFs.tempDir, 'cypress.config.js'), {
            webServerCommands: {
              default: 'npx nx run my-app:serve',
              production: 'npx nx run my-app:serve:production',
            },
            ciWebServerCommand: 'npx nx run my-app:serve-static',
          }),
          specPattern: '**/*.cy.ts',
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
        },
      })
    );
    const nodes = await createNodesFunction(
      ['cypress.config.js'],
      { targetName: 'e2e' },
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
                        "command": "cypress run --env webServerCommand="npx nx run my-app:serve:production"",
                      },
                    },
                    "dependsOn": [
                      {
                        "projects": [
                          "my-app",
                        ],
                        "target": "serve",
                      },
                    ],
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "nonAtomizedTarget": "e2e",
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
                    "command": "cypress run --env webServerCommand="npx nx run my-app:serve-static" --spec src/test.cy.ts --config="{\\"e2e\\":{\\"videosFolder\\":\\"dist/videos/src-test-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-cy-ts\\"}}"",
                    "dependsOn": [
                      {
                        "projects": [
                          "my-app",
                        ],
                        "target": "serve-static",
                      },
                    ],
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos/src-test-cy-ts",
                      "{projectRoot}/dist/screenshots/src-test-cy-ts",
                    ],
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "help": {
                        "command": "npx --ignore-scripts cypress open --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--e2e",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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

  it('should set parallelism to false and not infer commands in dependsOn if reuseExistingServer is false', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          ...nxE2EPreset(join(tempFs.tempDir, 'cypress.config.js'), {
            webServerCommands: {
              default: 'npx nx run my-app:serve',
              production: 'npx nx run my-app:serve:production',
            },
            ciWebServerCommand: 'npx nx run my-app:serve-static',
            webServerConfig: {
              reuseExistingServer: false,
            },
          }),
          specPattern: '**/*.cy.ts',
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
        },
      })
    );
    const nodes = await createNodesFunction(
      ['cypress.config.js'],
      { targetName: 'e2e' },
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
                        "command": "cypress run --env webServerCommand="npx nx run my-app:serve:production"",
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                    "parallelism": false,
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "nonAtomizedTarget": "e2e",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci--src/test.cy.ts": {
                    "cache": true,
                    "command": "cypress run --env webServerCommand="npx nx run my-app:serve-static" --spec src/test.cy.ts --config="{\\"e2e\\":{\\"videosFolder\\":\\"dist/videos/src-test-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-cy-ts\\"}}"",
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
                      "help": {
                        "command": "npx --ignore-scripts cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos/src-test-cy-ts",
                      "{projectRoot}/dist/screenshots/src-test-cy-ts",
                    ],
                    "parallelism": false,
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "help": {
                        "command": "npx --ignore-scripts cypress open --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--e2e",
                          ],
                        },
                      },
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
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
