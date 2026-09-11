import { CreateNodesContext } from '@nx/devkit';
import { defineConfig } from 'cypress';

import { createNodesV2 } from './plugin';
import { join } from 'path';
import { nxE2EPreset } from '../../plugins/cypress-preset';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { resetWorkspaceContext } from '@nx/devkit/internal';

var mockWorkspaceDataDir = '';
jest.mock('nx/src/utils/cache-directory', () => {
  const actual = jest.requireActual('nx/src/utils/cache-directory');
  return {
    ...actual,
    get workspaceDataDirectory() {
      return mockWorkspaceDataDir || actual.workspaceDataDirectory;
    },
  };
});

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
      'package-lock.json': '{}',
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
    };

    process.chdir(tempFs.tempDir);
    mockWorkspaceDataDir = join(tempFs.tempDir, '.nx', 'workspace-data');
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

  it('accepts an empty config list with a virtual workspace root', async () => {
    await expect(
      createNodesFunction(
        [],
        {},
        {
          ...context,
          workspaceRoot: join(tempFs.tempDir, 'virtual'),
        }
      )
    ).resolves.toEqual([]);
  });

  it('refreshes cached atomized targets and outputs after only a shared transitive config changes', async () => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    await tempFs.createFiles({
      'apps/e2e/package.json': '{}',
      'apps/e2e/cypress.config.cjs': `globalThis.__cypressInferenceLoads = (globalThis.__cypressInferenceLoads ?? 0) + 1; module.exports = require('../../shared/config.cjs');`,
      'apps/e2e/specs/a.cy.ts': '',
      'apps/e2e/specs/b.cy.ts': '',
      'shared/config.cjs': `const { selected } = require('./selection.json'); module.exports = { e2e: { specPattern: 'specs/' + selected + '.cy.ts', videosFolder: '../../out/' + selected, env: { ciWebServerCommand: 'echo ready' } } };`,
      'shared/selection.json': '{"selected":"a"}',
      'shared/unrelated.cjs': 'module.exports = 1;',
    });
    const infer = async () => {
      // Clear Jest's module registry while retaining the plugin's disk cache.
      jest.resetModules();
      const nodes = await createNodesFunction(
        ['apps/e2e/cypress.config.cjs'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      return nodes[0][1].projects['apps/e2e'].targets;
    };
    try {
      const first = await infer();
      expect(first['e2e-ci--specs/a.cy.ts']).toBeDefined();
      expect(first['e2e'].outputs.join()).toContain('out/a');
      expect((globalThis as any).__cypressInferenceLoads).toBe(1);

      tempFs.writeFile('shared/unrelated.cjs', 'module.exports = 2;');
      expect(await infer()).toEqual(first);
      expect((globalThis as any).__cypressInferenceLoads).toBe(1);

      tempFs.writeFile('shared/selection.json', '{"selected":"b"}');
      const second = await infer();
      expect(second['e2e-ci--specs/a.cy.ts']).toBeUndefined();
      expect(second['e2e-ci--specs/b.cy.ts']).toBeDefined();
      expect(second['e2e'].outputs.join()).toContain('out/b');
      expect((globalThis as any).__cypressInferenceLoads).toBe(2);
    } finally {
      delete (globalThis as any).__cypressInferenceLoads;
    }
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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
                        "command": "npx cypress run --help",
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
                        "options": "forward",
                        "params": "forward",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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
                        "command": "npx cypress run --help",
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
                        "options": "forward",
                        "params": "forward",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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
                        "command": "npx cypress run --help",
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
                        "options": "forward",
                        "params": "forward",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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

  it('should infer atomized tasks for component testing when "ciComponentTestingTargetName" is provided', async () => {
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
    // add a second test file to see multiple atomized tasks are created
    await tempFs.createFiles({ 'src/test-2.cy.ts': '' });

    const nodes = await createNodesFunction(
      ['cypress.config.js'],
      {
        componentTestingTargetName: 'component-test',
        ciComponentTestingTargetName: 'component-test-ci',
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
                    "Component Testing (CI)": [
                      "component-test-ci--src/test-2.cy.ts",
                      "component-test-ci--src/test.cy.ts",
                      "component-test-ci",
                    ],
                  },
                },
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
                        "command": "npx cypress run --help",
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
                  "component-test-ci": {
                    "cache": true,
                    "dependsOn": [
                      {
                        "options": "forward",
                        "params": "forward",
                        "target": "component-test-ci--src/test-2.cy.ts",
                      },
                      {
                        "options": "forward",
                        "params": "forward",
                        "target": "component-test-ci--src/test.cy.ts",
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
                      "description": "Runs Cypress Component Tests in CI",
                      "help": {
                        "command": "npx cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "nonAtomizedTarget": "component-test",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                  },
                  "component-test-ci--src/test-2.cy.ts": {
                    "cache": true,
                    "command": "cypress run --component --spec src/test-2.cy.ts --config="{\\"component\\":{\\"videosFolder\\":\\"dist/videos/src-test-2-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-2-cy-ts\\"}}"",
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
                      "description": "Runs Cypress Component Tests for src/test-2.cy.ts in CI",
                      "help": {
                        "command": "npx cypress run --help",
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
                      "{projectRoot}/dist/videos/src-test-2-cy-ts",
                      "{projectRoot}/dist/screenshots/src-test-2-cy-ts",
                    ],
                    "parallelism": false,
                  },
                  "component-test-ci--src/test.cy.ts": {
                    "cache": true,
                    "command": "cypress run --component --spec src/test.cy.ts --config="{\\"component\\":{\\"videosFolder\\":\\"dist/videos/src-test-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-cy-ts\\"}}"",
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
                      "description": "Runs Cypress Component Tests for src/test.cy.ts in CI",
                      "help": {
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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

  it('should normalize absolute screenshotsFolder and videosFolder for e2e and atomized e2e-ci targets', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          ...nxE2EPreset(join(tempFs.tempDir, 'cypress.config.js'), {
            webServerCommands: {
              default: 'my-app:serve',
            },
            ciWebServerCommand: 'my-app:serve-static',
          }),
          specPattern: '**/*.cy.ts',
          videosFolder: join(tempFs.tempDir, 'dist/videos'),
          screenshotsFolder: join(tempFs.tempDir, 'dist/screenshots'),
        },
      })
    );
    const nodes = await createNodesFunction(['cypress.config.js'], {}, context);

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
                        "command": "npx cypress run --help",
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
                        "options": "forward",
                        "params": "forward",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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

  it('should normalize absolute screenshotsFolder and videosFolder for atomized component-test-ci target', async () => {
    mockCypressConfig(
      defineConfig({
        component: {
          videosFolder: join(tempFs.tempDir, 'dist/videos'),
          screenshotsFolder: join(tempFs.tempDir, 'dist/screenshots'),
          devServer: {
            framework: 'react',
            bundler: 'webpack',
          },
        },
      })
    );
    await tempFs.createFiles({ 'src/test-2.cy.ts': '' });

    const nodes = await createNodesFunction(
      ['cypress.config.js'],
      {
        componentTestingTargetName: 'component-test',
        ciComponentTestingTargetName: 'component-test-ci',
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
                    "Component Testing (CI)": [
                      "component-test-ci--src/test-2.cy.ts",
                      "component-test-ci--src/test.cy.ts",
                      "component-test-ci",
                    ],
                  },
                },
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
                        "command": "npx cypress run --help",
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
                  "component-test-ci": {
                    "cache": true,
                    "dependsOn": [
                      {
                        "options": "forward",
                        "params": "forward",
                        "target": "component-test-ci--src/test-2.cy.ts",
                      },
                      {
                        "options": "forward",
                        "params": "forward",
                        "target": "component-test-ci--src/test.cy.ts",
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
                      "description": "Runs Cypress Component Tests in CI",
                      "help": {
                        "command": "npx cypress run --help",
                        "example": {
                          "args": [
                            "--dev",
                            "--headed",
                          ],
                        },
                      },
                      "nonAtomizedTarget": "component-test",
                      "technologies": [
                        "cypress",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/dist/videos",
                      "{projectRoot}/dist/screenshots",
                    ],
                  },
                  "component-test-ci--src/test-2.cy.ts": {
                    "cache": true,
                    "command": "cypress run --component --spec src/test-2.cy.ts --config="{\\"component\\":{\\"videosFolder\\":\\"dist/videos/src-test-2-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-2-cy-ts\\"}}"",
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
                      "description": "Runs Cypress Component Tests for src/test-2.cy.ts in CI",
                      "help": {
                        "command": "npx cypress run --help",
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
                      "{projectRoot}/dist/videos/src-test-2-cy-ts",
                      "{projectRoot}/dist/screenshots/src-test-2-cy-ts",
                    ],
                    "parallelism": false,
                  },
                  "component-test-ci--src/test.cy.ts": {
                    "cache": true,
                    "command": "cypress run --component --spec src/test.cy.ts --config="{\\"component\\":{\\"videosFolder\\":\\"dist/videos/src-test-cy-ts\\",\\"screenshotsFolder\\":\\"dist/screenshots/src-test-cy-ts\\"}}"",
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
                      "description": "Runs Cypress Component Tests for src/test.cy.ts in CI",
                      "help": {
                        "command": "npx cypress run --help",
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
                        "command": "npx cypress open --help",
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

  it('should emit {workspaceRoot} outputs and dotted-relative --config paths when folders sit outside the project root but inside the workspace', async () => {
    await tempFs.createFiles({
      'apps/myapp/package.json': '{}',
      'apps/myapp/cypress.config.js': '',
      'apps/myapp/src/test.cy.ts': '',
    });

    const cypressConfig = defineConfig({
      e2e: {
        ...nxE2EPreset(join(tempFs.tempDir, 'apps/myapp/cypress.config.js'), {
          webServerCommands: { default: 'my-app:serve' },
          ciWebServerCommand: 'my-app:serve-static',
        }),
        specPattern: '**/*.cy.ts',
        videosFolder: join(tempFs.tempDir, 'dist/videos'),
        screenshotsFolder: join(tempFs.tempDir, 'dist/screenshots'),
      },
    });
    jest.mock(
      join(tempFs.tempDir, 'apps/myapp/cypress.config.js'),
      () => ({ default: cypressConfig }),
      { virtual: true }
    );

    const nodes = await createNodesFunction(
      ['apps/myapp/cypress.config.js'],
      {},
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "apps/myapp/cypress.config.js",
          {
            "projects": {
              "apps/myapp": {
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
                        "command": "npx cypress run --help",
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
                      "cwd": "apps/myapp",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/videos",
                      "{workspaceRoot}/dist/screenshots",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci": {
                    "cache": true,
                    "dependsOn": [
                      {
                        "options": "forward",
                        "params": "forward",
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
                        "command": "npx cypress run --help",
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
                      "{workspaceRoot}/dist/videos",
                      "{workspaceRoot}/dist/screenshots",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci--src/test.cy.ts": {
                    "cache": true,
                    "command": "cypress run --env webServerCommand="my-app:serve-static" --spec src/test.cy.ts --config="{\\"e2e\\":{\\"videosFolder\\":\\"../../dist/videos/src-test-cy-ts\\",\\"screenshotsFolder\\":\\"../../dist/screenshots/src-test-cy-ts\\"}}"",
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
                        "command": "npx cypress run --help",
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
                      "cwd": "apps/myapp",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/videos/src-test-cy-ts",
                      "{workspaceRoot}/dist/screenshots/src-test-cy-ts",
                    ],
                    "parallelism": false,
                  },
                  "open-cypress": {
                    "command": "cypress open",
                    "metadata": {
                      "description": "Opens Cypress",
                      "help": {
                        "command": "npx cypress open --help",
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
                      "cwd": "apps/myapp",
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
    tempFs.createFileSync(
      'cypress.config.js',
      `module.exports = ${JSON.stringify(cypressConfig)}`
    );
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
