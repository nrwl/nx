import { CreateNodesContext, workspaceRoot } from '@nx/devkit';
import { setWorkspaceRoot } from '@nx/devkit/internal';
import * as devkitInternal from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import * as jsUtils from '@nx/js';
import { PlaywrightTestConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { _clearWarnedUnparseableCommands, createNodesV2 } from './plugin';
import { _setChildEval, normalizeWebServers } from './webserver-readiness';

// The plugin writes its disk cache under `workspaceDataDirectory`, which is
// resolved from the real workspace root at import time. Redirect it into the
// test's temp dir so cache round-trips stay isolated from the repo. `var` so
// import-time readers of the export (nx's daemon tmp-dir) see the hoisted
// empty value and fall back to the actual path instead of hitting the TDZ.
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

// The production resolver forks a child whose worker only exists in dist. In
// tests, mirror the child by evaluating the config source in a fresh scope under
// the task env; the in-process module cache would otherwise return the ambient
// evaluation. Only handles the simple CJS configs the env tests use.
function installFreshConfigEval(
  onEval?: (env: NodeJS.ProcessEnv) => void
): void {
  _setChildEval(async (configFilePath, wsRoot, env) => {
    onEval?.(env);
    const source = readFileSync(join(wsRoot, configFilePath), 'utf8');
    const moduleShim: { exports: PlaywrightTestConfig } = { exports: {} };
    new Function('module', 'exports', 'process', source)(
      moduleShim,
      moduleShim.exports,
      { ...process, env }
    );
    return normalizeWebServers(moduleShim.exports.webServer);
  });
}

describe('@nx/playwright/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd = process.cwd();
  let originalCacheProjectGraph: string | undefined;

  beforeEach(async () => {
    tempFs = new TempFs('playwright-plugin');
    await tempFs.createFiles({
      'package.json': '{}',
      'package-lock.json': '{}',
      'playwright.config.js': 'module.exports = {}',
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

    process.chdir(tempFs.tempDir);
    mockWorkspaceDataDir = join(tempFs.tempDir, '.nx', 'workspace-data');
    originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    // The warn-once set outlives a test; without the reset, a warn assertion
    // is coupled to its (config, command) pair being unique in the file.
    _clearWarnedUnparseableCommands();
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(cwd);
    process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
  });

  it('should create nodes with default playwright configuration', async () => {
    await mockPlaywrightConfig(tempFs, {});
    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
      },
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "playwright.config.js",
          {
            "projects": {
              ".": {
                "metadata": {
                  "targetGroups": {
                    "E2E (CI)": [
                      "e2e-ci",
                      "e2e-ci--merge-reports",
                    ],
                  },
                },
                "root": ".",
                "targets": {
                  "e2e": {
                    "cache": true,
                    "command": "playwright test",
                    "inputs": [
                      "default",
                      "^production",
                      "^{projectRoot}/tsconfig*.json",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests",
                      "help": {
                        "command": "npx playwright test --help",
                        "example": {
                          "options": {
                            "workers": 1,
                          },
                        },
                      },
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "options": {
                      "cwd": "{projectRoot}",
                    },
                    "outputs": [
                      "{projectRoot}/test-results",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci": {
                    "cache": true,
                    "dependsOn": [],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      "^{projectRoot}/tsconfig*.json",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests in CI",
                      "help": {
                        "command": "npx playwright test --help",
                        "example": {
                          "options": {
                            "workers": 1,
                          },
                        },
                      },
                      "nonAtomizedTarget": "e2e",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/test-results",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci--merge-reports": {
                    "cache": true,
                    "continuous": false,
                    "executor": "@nx/playwright:merge-reports",
                    "inputs": [
                      "default",
                      "^production",
                      "^{projectRoot}/tsconfig*.json",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Merges Playwright blob reports from atomized tasks to produce unified reports for the configured reporters.",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "options": {
                      "config": "playwright.config.js",
                      "expectedSuites": 0,
                    },
                    "outputs": [],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should create nodes with reporters configured', async () => {
    await mockPlaywrightConfig(tempFs, {
      reporter: [
        ['list'],
        [
          'json',
          // test absolute path
          { outputFile: join(tempFs.tempDir, 'test-results/report.json') },
        ],
        // test relative path
        ['html', { outputFolder: 'test-results/html' }],
      ],
    });
    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
      },
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "playwright.config.js",
          {
            "projects": {
              ".": {
                "metadata": {
                  "targetGroups": {
                    "E2E (CI)": [
                      "e2e-ci",
                      "e2e-ci--merge-reports",
                    ],
                  },
                },
                "root": ".",
                "targets": {
                  "e2e": {
                    "cache": true,
                    "command": "playwright test",
                    "inputs": [
                      "default",
                      "^production",
                      "^{projectRoot}/tsconfig*.json",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests",
                      "help": {
                        "command": "npx playwright test --help",
                        "example": {
                          "options": {
                            "workers": 1,
                          },
                        },
                      },
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "options": {
                      "cwd": "{projectRoot}",
                    },
                    "outputs": [
                      "{projectRoot}/test-results",
                      "{projectRoot}/test-results/report.json",
                      "{projectRoot}/test-results/html",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci": {
                    "cache": true,
                    "dependsOn": [],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      "^{projectRoot}/tsconfig*.json",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests in CI",
                      "help": {
                        "command": "npx playwright test --help",
                        "example": {
                          "options": {
                            "workers": 1,
                          },
                        },
                      },
                      "nonAtomizedTarget": "e2e",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/test-results",
                      "{projectRoot}/test-results/report.json",
                      "{projectRoot}/test-results/html",
                    ],
                    "parallelism": false,
                  },
                  "e2e-ci--merge-reports": {
                    "cache": true,
                    "continuous": false,
                    "executor": "@nx/playwright:merge-reports",
                    "inputs": [
                      "default",
                      "^production",
                      "^{projectRoot}/tsconfig*.json",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Merges Playwright blob reports from atomized tasks to produce unified reports for the configured reporters.",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "options": {
                      "config": "playwright.config.js",
                      "expectedSuites": 0,
                    },
                    "outputs": [
                      "{projectRoot}/test-results/report.json",
                      "{projectRoot}/test-results/html",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should create nodes for distributed CI', async () => {
    await mockPlaywrightConfig(
      tempFs,
      `module.exports = {
      testDir: 'tests',
      testIgnore: [/.*skip.*/, '**/ignored/**'],
      reporter: [
        ['html', { outputFolder: 'test-results/html' }],
        ['junit', { outputFile: 'test-results/report.xml' }],
      ],
    }`
    );
    await tempFs.createFiles({
      'tests/run-me.spec.ts': '',
      'tests/run-me-2.spec.ts': '',
      'tests/skip-me.spec.ts': '',
      'tests/ignored/run-me.spec.ts': '',
      'not-tests/run-me.spec.ts': '',
    });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;
    expect(project.metadata.targetGroups).toMatchInlineSnapshot(`
      {
        "E2E (CI)": [
          "e2e-ci--tests/run-me-2.spec.ts",
          "e2e-ci--tests/run-me.spec.ts",
          "e2e-ci",
          "e2e-ci--merge-reports",
        ],
      }
    `);
    expect(targets['e2e-ci']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me-2.spec.ts",
          },
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me.spec.ts",
          },
        ],
        "executor": "nx:noop",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "nonAtomizedTarget": "e2e",
          "technologies": [
            "playwright",
          ],
        },
        "outputs": [
          "{projectRoot}/test-results",
          "{projectRoot}/test-results/html",
          "{projectRoot}/test-results/report.xml",
        ],
        "parallelism": false,
      }
    `);
    expect(targets['e2e-ci--tests/run-me.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me.spec.ts --output=test-results/tests-run-me-spec-ts",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {
            "PLAYWRIGHT_HTML_OUTPUT_DIR": "test-results/html/tests-run-me-spec-ts",
            "PLAYWRIGHT_HTML_REPORT": "test-results/html/tests-run-me-spec-ts",
            "PLAYWRIGHT_JUNIT_OUTPUT_FILE": "test-results/tests-run-me-spec-ts/report.xml",
          },
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-spec-ts",
          "{projectRoot}/test-results/html/tests-run-me-spec-ts",
          "{projectRoot}/test-results/tests-run-me-spec-ts/report.xml",
        ],
        "parallelism": false,
      }
    `);
    expect(targets['e2e-ci--tests/run-me-2.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me-2.spec.ts --output=test-results/tests-run-me-2-spec-ts",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me-2.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {
            "PLAYWRIGHT_HTML_OUTPUT_DIR": "test-results/html/tests-run-me-2-spec-ts",
            "PLAYWRIGHT_HTML_REPORT": "test-results/html/tests-run-me-2-spec-ts",
            "PLAYWRIGHT_JUNIT_OUTPUT_FILE": "test-results/tests-run-me-2-spec-ts/report.xml",
          },
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-2-spec-ts",
          "{projectRoot}/test-results/html/tests-run-me-2-spec-ts",
          "{projectRoot}/test-results/tests-run-me-2-spec-ts/report.xml",
        ],
        "parallelism": false,
      }
    `);
    expect(targets['e2e-ci--tests/skip-me.spec.ts']).not.toBeDefined();
    expect(targets['e2e-ci--tests/ignored/run-me.spec.ts']).not.toBeDefined();
    expect(targets['e2e-ci--not-tests/run-me.spec.ts']).not.toBeDefined();
  });

  it('should create nodes for distributed CI and merge reports', async () => {
    await mockPlaywrightConfig(
      tempFs,
      `module.exports = {
      testDir: 'tests',
      reporter: [
        ['html', { outputFolder: 'test-results/html' }],
        ['junit', { outputFile: 'test-results/report.xml' }],
        ['blob', { outputFile: 'blob-report/blob.zip' }],
      ],
    }`
    );
    await tempFs.createFiles({
      'tests/run-me.spec.ts': '',
      'tests/run-me-2.spec.ts': '',
    });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;
    expect(project.metadata.targetGroups).toMatchInlineSnapshot(`
      {
        "E2E (CI)": [
          "e2e-ci--tests/run-me-2.spec.ts",
          "e2e-ci--tests/run-me.spec.ts",
          "e2e-ci",
          "e2e-ci--merge-reports",
        ],
      }
    `);
    expect(targets['e2e-ci']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me-2.spec.ts",
          },
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me.spec.ts",
          },
        ],
        "executor": "nx:noop",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "nonAtomizedTarget": "e2e",
          "technologies": [
            "playwright",
          ],
        },
        "outputs": [
          "{projectRoot}/test-results",
          "{projectRoot}/test-results/html",
          "{projectRoot}/test-results/report.xml",
          "{projectRoot}/blob-report",
        ],
        "parallelism": false,
      }
    `);
    expect(targets['e2e-ci--tests/run-me.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me.spec.ts --output=test-results/tests-run-me-spec-ts",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {
            "PLAYWRIGHT_BLOB_OUTPUT_FILE": "blob-report/tests-run-me-spec-ts.zip",
            "PLAYWRIGHT_HTML_OUTPUT_DIR": "test-results/html/tests-run-me-spec-ts",
            "PLAYWRIGHT_HTML_REPORT": "test-results/html/tests-run-me-spec-ts",
            "PLAYWRIGHT_JUNIT_OUTPUT_FILE": "test-results/tests-run-me-spec-ts/report.xml",
          },
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-spec-ts",
          "{projectRoot}/test-results/html/tests-run-me-spec-ts",
          "{projectRoot}/test-results/tests-run-me-spec-ts/report.xml",
          "{projectRoot}/blob-report/tests-run-me-spec-ts.zip",
        ],
        "parallelism": false,
      }
    `);
    expect(targets['e2e-ci--tests/run-me-2.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me-2.spec.ts --output=test-results/tests-run-me-2-spec-ts",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me-2.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {
            "PLAYWRIGHT_BLOB_OUTPUT_FILE": "blob-report/tests-run-me-2-spec-ts.zip",
            "PLAYWRIGHT_HTML_OUTPUT_DIR": "test-results/html/tests-run-me-2-spec-ts",
            "PLAYWRIGHT_HTML_REPORT": "test-results/html/tests-run-me-2-spec-ts",
            "PLAYWRIGHT_JUNIT_OUTPUT_FILE": "test-results/tests-run-me-2-spec-ts/report.xml",
          },
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-2-spec-ts",
          "{projectRoot}/test-results/html/tests-run-me-2-spec-ts",
          "{projectRoot}/test-results/tests-run-me-2-spec-ts/report.xml",
          "{projectRoot}/blob-report/tests-run-me-2-spec-ts.zip",
        ],
        "parallelism": false,
      }
    `);
    expect(targets['e2e-ci--merge-reports']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "continuous": false,
        "executor": "@nx/playwright:merge-reports",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Merges Playwright blob reports from atomized tasks to produce unified reports for the configured reporters.",
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "config": "playwright.config.js",
          "expectedSuites": 2,
        },
        "outputs": [
          "{projectRoot}/test-results/html",
          "{projectRoot}/test-results/report.xml",
        ],
      }
    `);
  });

  it('should infer dependsOn using the task run in the webServer.command and not set parallelism to false', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({
      'tests/run-me.spec.ts': '',
      'tests/run-me-2.spec.ts': '',
    });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;
    expect(targets['e2e']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test",
        "dependsOn": [
          {
            "projects": [
              "app1",
            ],
            "target": "serve",
          },
        ],
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
      }
    `);
    expect(targets['e2e-ci']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me-2.spec.ts",
          },
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me.spec.ts",
          },
        ],
        "executor": "nx:noop",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "nonAtomizedTarget": "e2e",
          "technologies": [
            "playwright",
          ],
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
      }
    `);
    expect(project.metadata.targetGroups).toMatchInlineSnapshot(`
      {
        "E2E (CI)": [
          "e2e-ci--tests/run-me-2.spec.ts",
          "e2e-ci--tests/run-me.spec.ts",
          "e2e-ci",
          "e2e-ci--merge-reports",
        ],
      }
    `);
    expect(targets['e2e-ci--tests/run-me.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me.spec.ts --output=test-results/tests-run-me-spec-ts",
        "dependsOn": [
          {
            "projects": [
              "app1",
            ],
            "target": "serve",
          },
        ],
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {},
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-spec-ts",
        ],
      }
    `);
    expect(targets['e2e-ci--tests/run-me-2.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me-2.spec.ts --output=test-results/tests-run-me-2-spec-ts",
        "dependsOn": [
          {
            "projects": [
              "app1",
            ],
            "target": "serve",
          },
        ],
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me-2.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {},
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-2-spec-ts",
        ],
      }
    `);
  });

  it('should infer a wait-for-webserver task and wire the e2e and atomized CI tasks to it when the webServer defines a port', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        port: 4200,
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({
      'tests/run-me.spec.ts': '',
      'tests/run-me-2.spec.ts': '',
    });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;

    expect(targets['e2e--wait-for-webserver']).toEqual({
      executor: '@nx/playwright:wait-for-webserver',
      cache: false,
      options: { servers: [{ port: 4200 }] },
      dependsOn: [{ projects: ['app1'], target: 'serve' }],
      metadata: {
        technologies: ['playwright'],
        description:
          'Waits for the E2E web server(s) to be ready before the Playwright test tasks run.',
      },
    });
    // atomized CI tasks keep the continuous serve dependency (to keep it alive)
    // and add the discrete readiness gate as a barrier.
    expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
      { target: 'e2e--wait-for-webserver' },
    ]);
    expect(targets['e2e-ci--tests/run-me-2.spec.ts'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
      { target: 'e2e--wait-for-webserver' },
    ]);
    // the non-CI e2e task shares the same readiness gate as a barrier on top of
    // the continuous serve dependency.
    expect(targets['e2e'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
      { target: 'e2e--wait-for-webserver' },
    ]);
    expect(project.metadata.targetGroups['E2E (CI)']).toContain(
      'e2e--wait-for-webserver'
    );
  });

  it('does not infer a wait-for-webserver task when waitForWebServer is false', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        port: 4200,
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({
      'tests/run-me.spec.ts': '',
    });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
        waitForWebServer: false,
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;

    // No gate is inferred; the serve dependency stays so the tests still start
    // the server, but readiness falls back to Playwright's own probe.
    expect(targets['e2e--wait-for-webserver']).toBeUndefined();
    expect(targets['e2e'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
    ]);
    expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
    ]);
    expect(project.metadata.targetGroups['E2E (CI)']).not.toContain(
      'e2e--wait-for-webserver'
    );
  });

  it('resolves the serve dependency under the task env even when waitForWebServer is false', async () => {
    const originalServeTarget = process.env.SERVE_TARGET;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.SERVE_TARGET;
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: process.env.SERVE_TARGET === 'mock'
      ? 'npx nx run app1:serve-mock'
      : 'npx nx run app1:serve',
    port: 4200,
    reuseExistingServer: true,
  },
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'SERVE_TARGET=mock\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci', waitForWebServer: false },
        context
      );
      const { targets } = results[0][1].projects['.'];

      // The flag opts out of the gate only; the dependency still comes from
      // the config as the task's env would evaluate it.
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve-mock' },
      ]);
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve-mock' },
      ]);
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalServeTarget === undefined) {
        delete process.env.SERVE_TARGET;
      } else {
        process.env.SERVE_TARGET = originalServeTarget;
      }
    }
  });

  it('rebuilds cached dependencies on a dotenv change when waitForWebServer is false', async () => {
    const originalServeTarget = process.env.SERVE_TARGET;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.SERVE_TARGET;
    setWorkspaceRoot(tempFs.tempDir);
    // With the gate opted out the dotenv still selects the dependencies, so
    // the disk cache key must fold it in; only a cache miss re-resolves.
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    installFreshConfigEval();

    try {
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': `module.exports = {
  testDir: 'tests',
  webServer: {
    command: process.env.SERVE_TARGET === 'mock'
      ? 'npx nx run app1:serve-mock'
      : 'npx nx run app1:serve',
    port: 4200,
    reuseExistingServer: true,
  },
};`,
        'apps/e2e/tests/run-me.spec.ts': '',
        '.env': 'SERVE_TARGET=mock\n',
      });

      const run = async () =>
        (
          await createNodesFunction(
            ['apps/e2e/playwright.config.js'],
            {
              targetName: 'e2e',
              ciTargetName: 'e2e-ci',
              waitForWebServer: false,
            },
            context
          )
        )[0][1].projects['apps/e2e'].targets;

      const first = await run();
      expect(first['e2e'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve-mock' },
      ]);

      await tempFs.createFile('.env', 'SERVE_TARGET=other\n');
      const second = await run();
      expect(second['e2e'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
      ]);
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalServeTarget === undefined) {
        delete process.env.SERVE_TARGET;
      } else {
        process.env.SERVE_TARGET = originalServeTarget;
      }
    }
  });

  it('should infer a wait-for-webserver task using the url when the webServer defines a url', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options).toEqual({
      servers: [{ url: 'http://localhost:4200' }],
    });
    expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
      { target: 'e2e--wait-for-webserver' },
    ]);
  });

  it('resolves the task dotenv env before baking the wait-for-webserver gate', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    // Isolate the .env as the only source of BASE_URL; a value left in the
    // ambient env would satisfy the config on its own and mask the dotenv load.
    delete process.env.BASE_URL;
    // getGraphTimeDotEnvForTask resolves dotenv relative to the workspace root.
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e--wait-for-webserver'].options).toEqual({
        servers: [{ url: 'http://localhost:4301' }],
      });
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('creates a separate gate per chain when e2e and e2e-ci resolve different addresses', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      // The e2e-ci chain also loads .env.e2e-ci, which wins over .env.e2e, so
      // the two chains resolve different addresses and each gets its own gate.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e': 'BASE_URL=http://localhost:4301\n',
        '.env.e2e-ci': 'BASE_URL=http://localhost:4302\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
      expect(targets['e2e-ci--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4302' },
      ]);
      expect(targets['e2e'].dependsOn).toContainEqual({
        target: 'e2e--wait-for-webserver',
      });
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toContainEqual({
        target: 'e2e-ci--wait-for-webserver',
      });
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('skips the gate but keeps the dependency when a task env file changes how the server would be probed', async () => {
    const savedEnv = saveEnv([
      'HTTP_PROXY',
      'http_proxy',
      'NO_PROXY',
      'no_proxy',
    ]);
    const originalWorkspaceRoot = workspaceRoot;
    // The gate task runs under its own dotenv, so a task-scoped proxy
    // exclusion never reaches it: probing through the ambient proxy could time
    // out where Playwright's own probe (under the task env) goes direct.
    process.env.HTTP_PROXY = 'http://proxy.example:8080';
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: [
    { command: 'npx nx run app1:serve', port: 4200, reuseExistingServer: true },
    { command: 'npx nx run api1:serve', url: 'http://localhost:4300', reuseExistingServer: true },
  ],
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e': 'NO_PROXY=localhost\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      // The whole chain's gate is skipped, the port-only server included: the
      // gate is a single task and a partial wait would claim readiness it
      // never checked.
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e-ci--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].dependsOn).toContainEqual({
        projects: ['app1', 'api1'],
        target: 'serve',
      });
      expect(targets['e2e'].parallelism).toBeUndefined();
      // The warning names the diverging variables, never their values.
      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('NO_PROXY')
      );
      expect(warn).not.toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('localhost')
      );
    } finally {
      warn.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      restoreEnv(savedEnv);
    }
  });

  it('keeps the gate of a chain whose task env does not change the probe', async () => {
    const savedEnv = saveEnv([
      'HTTP_PROXY',
      'http_proxy',
      'NO_PROXY',
      'no_proxy',
    ]);
    const originalWorkspaceRoot = workspaceRoot;
    process.env.HTTP_PROXY = 'http://proxy.example:8080';
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      // Only the atomized chain loads the exclusion, so only its gate is
      // skipped; the e2e chain keeps its own.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e-ci': 'NO_PROXY=localhost\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4200' },
      ]);
      expect(targets['e2e'].dependsOn).toContainEqual({
        target: 'e2e--wait-for-webserver',
      });
      expect(targets['e2e-ci--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toContainEqual({
        projects: ['app1'],
        target: 'serve',
      });
      expect(
        targets['e2e-ci--tests/run-me.spec.ts'].dependsOn
      ).not.toContainEqual(
        expect.objectContaining({ target: expect.stringContaining('wait-for') })
      );
      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('e2e-ci')
      );
    } finally {
      warn.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      restoreEnv(savedEnv);
    }
  });

  it('keeps a port-only gate under a task env that only changes url probing', async () => {
    const savedEnv = saveEnv([
      'HTTP_PROXY',
      'http_proxy',
      'NO_PROXY',
      'no_proxy',
    ]);
    const originalWorkspaceRoot = workspaceRoot;
    process.env.HTTP_PROXY = 'http://proxy.example:8080';
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    port: 4200,
    reuseExistingServer: true,
  },
};`
      );
      // A port is probed with a raw TCP connect, which no proxy or TLS env
      // affects.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e': 'NO_PROXY=localhost\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
        { port: 4200 },
      ]);
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      restoreEnv(savedEnv);
    }
  });

  it('skips the gate when a task env file changes the TLS material of a verifying https probe', async () => {
    const savedEnv = saveEnv(['NODE_EXTRA_CA_CERTS']);
    const originalWorkspaceRoot = workspaceRoot;
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: 'https://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e': 'NODE_EXTRA_CA_CERTS=./certs/ca.pem\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].dependsOn).toContainEqual({
        projects: ['app1'],
        target: 'serve',
      });
      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('NODE_EXTRA_CA_CERTS')
      );
    } finally {
      warn.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      restoreEnv(savedEnv);
    }
  });

  it('serializes the atomized tasks when only the CI chain adds an uncovered server', async () => {
    const originalCiExtra = process.env.CI_EXTRA;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.CI_EXTRA;
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: [
    {
      command: 'npx nx run app1:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
    },
    ...(process.env.CI_EXTRA
      ? [{ command: 'node worker.js', reuseExistingServer: true }]
      : []),
  ],
};`
      );
      // Both chains resolve the same inferred server and address, so they
      // share the gate; only the CI chain sees the extra uncovered server.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e-ci': 'CI_EXTRA=1\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e--wait-for-webserver']).toBeDefined();
      expect(targets['e2e-ci--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].parallelism).toBeUndefined();
      // The uncovered worker server races parallel atomized runs, so they
      // must serialize even though the gate is shared.
      expect(targets['e2e-ci--tests/run-me.spec.ts'].parallelism).toBe(false);
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toContainEqual({
        target: 'e2e--wait-for-webserver',
      });
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalCiExtra === undefined) {
        delete process.env.CI_EXTRA;
      } else {
        process.env.CI_EXTRA = originalCiExtra;
      }
    }
  });

  it('clears the inherited parallelism when only the CI chain resolves serve tasks', async () => {
    const originalServeCommand = process.env.SERVE_COMMAND;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.SERVE_COMMAND;
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval();

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: process.env.SERVE_COMMAND || 'node server.js',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      // Only the e2e-ci chain resolves an inferrable serve command, so the
      // atomized tasks must swap the inherited parallelism: false for the CI
      // chain's dependsOn rather than carry both.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env.e2e-ci': 'SERVE_COMMAND=npx nx run app1:serve\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(targets['e2e'].parallelism).toBe(false);
      expect(targets['e2e'].dependsOn).toBeUndefined();
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();

      const atomized = targets['e2e-ci--tests/run-me.spec.ts'];
      expect(atomized.dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
        { target: 'e2e-ci--wait-for-webserver' },
      ]);
      expect(atomized.parallelism).toBeUndefined();
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalServeCommand === undefined) {
        delete process.env.SERVE_COMMAND;
      } else {
        process.env.SERVE_COMMAND = originalServeCommand;
      }
    }
  });

  it('rebuilds a cached gate when a dotenv outside the project changes', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    // The disk cache is what carries a stale gate across runs, so this test
    // needs it on, unlike the rest of the suite.
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    let evals = 0;
    installFreshConfigEval(() => evals++);

    try {
      // A nested project whose config reads a workspace-root .env: the .env is
      // outside the project's createNodes hash, so only the dotenv fingerprint
      // in the plugin cache key can pick up a change to it.
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`,
        'apps/e2e/tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const run = async () =>
        (
          await createNodesFunction(
            ['apps/e2e/playwright.config.js'],
            { targetName: 'e2e', ciTargetName: 'e2e-ci' },
            context
          )
        )[0][1].projects['apps/e2e'].targets;

      const first = await run();
      expect(first['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
      const evalsAfterFirst = evals;

      const second = await run();
      expect(second['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
      expect(evals).toBe(evalsAfterFirst);

      await tempFs.createFile('.env', 'BASE_URL=http://localhost:4302\n');
      const third = await run();
      expect(third['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4302' },
      ]);
      expect(evals).toBeGreaterThan(evalsAfterFirst);
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('rebuilds a cached gate when a dotenv change round-trips through the ambient env', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    setWorkspaceRoot(tempFs.tempDir);
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    installFreshConfigEval();
    // The task env matches ambient in this scenario, so no child evaluation
    // runs and the gate's address comes from the in-process config load, which
    // jest's module registry pins to its first evaluation. Observe the rebuild
    // through the test-file listing instead, which only a cache miss reaches.
    const listTestFiles = jest.spyOn(
      devkitInternal,
      'getFilesInDirectoryUsingContext'
    );

    try {
      // The daemon loads the root .env into its own env at startup, so the
      // ambient env and the file agree and the task env matches ambient. After
      // an edit plus a daemon restart they agree again on the new value: only
      // the file content in the plugin cache key can tell the two runs apart,
      // an env-delta digest sees an empty delta in both.
      process.env.BASE_URL = 'http://localhost:4301';
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`,
        'apps/e2e/tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const run = async () =>
        (
          await createNodesFunction(
            ['apps/e2e/playwright.config.js'],
            { targetName: 'e2e', ciTargetName: 'e2e-ci' },
            context
          )
        )[0][1].projects['apps/e2e'].targets;

      const first = await run();
      expect(first['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
      const rebuildsAfterFirst = listTestFiles.mock.calls.length;

      // A rerun with nothing changed stays cached.
      await run();
      expect(listTestFiles.mock.calls.length).toBe(rebuildsAfterFirst);

      process.env.BASE_URL = 'http://localhost:4302';
      await tempFs.createFile('.env', 'BASE_URL=http://localhost:4302\n');
      await run();
      expect(listTestFiles.mock.calls.length).toBeGreaterThan(
        rebuildsAfterFirst
      );
    } finally {
      listTestFiles.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('rebuilds cached targets when an allowed ambient env var changes', async () => {
    const originalToolHome = process.env.TOOL_HOME;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.TOOL_HOME;
    setWorkspaceRoot(tempFs.tempDir);
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    // The cache hit/miss is not observable through the returned targets (the
    // in-process config load is pinned to its first evaluation), so observe it
    // through the test-file listing, which only a cache miss reaches.
    const listTestFiles = jest.spyOn(
      devkitInternal,
      'getFilesInDirectoryUsingContext'
    );

    try {
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': 'module.exports = {}',
      });

      const run = () =>
        createNodesFunction(
          ['apps/e2e/playwright.config.js'],
          { targetName: 'e2e', ciTargetName: 'e2e-ci' },
          context
        );

      await run();
      const rebuildsAfterFirst = listTestFiles.mock.calls.length;

      // A rerun with nothing changed stays cached.
      await run();
      expect(listTestFiles.mock.calls.length).toBe(rebuildsAfterFirst);

      process.env.TOOL_HOME = '/usr/lib/tool';
      await run();
      expect(listTestFiles.mock.calls.length).toBeGreaterThan(
        rebuildsAfterFirst
      );
    } finally {
      listTestFiles.mockRestore();
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalToolHome === undefined) {
        delete process.env.TOOL_HOME;
      } else {
        process.env.TOOL_HOME = originalToolHome;
      }
    }
  });

  it('keeps cached targets when an excluded ambient env var changes', async () => {
    const originalItermProfile = process.env.ITERM_PROFILE;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.ITERM_PROFILE;
    setWorkspaceRoot(tempFs.tempDir);
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    const listTestFiles = jest.spyOn(
      devkitInternal,
      'getFilesInDirectoryUsingContext'
    );

    try {
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': 'module.exports = {}',
      });

      const run = () =>
        createNodesFunction(
          ['apps/e2e/playwright.config.js'],
          { targetName: 'e2e', ciTargetName: 'e2e-ci' },
          context
        );

      await run();
      const rebuildsAfterFirst = listTestFiles.mock.calls.length;

      process.env.ITERM_PROFILE = 'Default';
      await run();
      expect(listTestFiles.mock.calls.length).toBe(rebuildsAfterFirst);
    } finally {
      listTestFiles.mockRestore();
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalItermProfile === undefined) {
        delete process.env.ITERM_PROFILE;
      } else {
        process.env.ITERM_PROFILE = originalItermProfile;
      }
    }
  });

  it('does not persist a pass whose ambient env changed mid-pass', async () => {
    const originalBootFlag = process.env.BOOT_FLAG;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BOOT_FLAG;
    setWorkspaceRoot(tempFs.tempDir);
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    const listTestFiles = jest.spyOn(
      devkitInternal,
      'getFilesInDirectoryUsingContext'
    );

    try {
      // The config mutates an allowed env var when evaluated, so the pass's
      // entries are keyed under a digest that no longer matches the env they
      // were built in. The pass must not persist them: a later pass under the
      // original env would otherwise hit an entry built under the mutated one.
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': `process.env.BOOT_FLAG = 'set';
module.exports = {};`,
      });

      const run = () =>
        createNodesFunction(
          ['apps/e2e/playwright.config.js'],
          { targetName: 'e2e', ciTargetName: 'e2e-ci' },
          context
        );

      await run();
      const rebuildsAfterFirst = listTestFiles.mock.calls.length;

      // Back on the pass-start env: the same cache key, so only the skipped
      // persist can force this re-evaluation.
      delete process.env.BOOT_FLAG;
      await run();
      expect(listTestFiles.mock.calls.length).toBeGreaterThan(
        rebuildsAfterFirst
      );
    } finally {
      listTestFiles.mockRestore();
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalBootFlag === undefined) {
        delete process.env.BOOT_FLAG;
      } else {
        process.env.BOOT_FLAG = originalBootFlag;
      }
    }
  });

  it('does not persist a pass during which the daemon swapped the env away and back', async () => {
    const originalWorkspaceRoot = workspaceRoot;
    setWorkspaceRoot(tempFs.tempDir);
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    const listTestFiles = jest.spyOn(
      devkitInternal,
      'getFilesInDirectoryUsingContext'
    );
    // Another client's env landing on the worker mid-pass and being restored
    // before the pass ends reproduces the pass-start digest, so only the
    // application count can reveal that entries were built under the interim
    // env. Simulated through the count alone: it moves between the pass-start
    // read and the write-guard read.
    const envGeneration = jest.spyOn(
      devkitInternal,
      'getDaemonClientEnvGeneration'
    );
    envGeneration.mockReturnValueOnce(0);
    envGeneration.mockReturnValue(1);

    try {
      await tempFs.createFiles({
        'apps/e2e/project.json': '{}',
        'apps/e2e/playwright.config.js': 'module.exports = {}',
      });

      const run = () =>
        createNodesFunction(
          ['apps/e2e/playwright.config.js'],
          { targetName: 'e2e', ciTargetName: 'e2e-ci' },
          context
        );

      await run();
      const rebuildsAfterFirst = listTestFiles.mock.calls.length;

      // The env (and so the cache key) matches the first pass, so only the
      // skipped persist can force this re-evaluation.
      await run();
      expect(listTestFiles.mock.calls.length).toBeGreaterThan(
        rebuildsAfterFirst
      );
    } finally {
      listTestFiles.mockRestore();
      envGeneration.mockRestore();
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    }
  });

  it('shares one config re-evaluation when both chains load the same dotenv inputs', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    let evals = 0;
    installFreshConfigEval(() => evals++);

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(evals).toBe(1);
      expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
      expect(targets['e2e-ci--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toContainEqual({
        target: 'e2e--wait-for-webserver',
      });
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('skips the task-env config re-evaluation when the config has no webServer', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    let evals = 0;
    installFreshConfigEval(() => evals++);

    try {
      await mockPlaywrightConfig(tempFs, { testDir: 'tests' });
      // The dotenv makes the task env diverge from ambient, but with no
      // ambient webServer there is nothing to gate, so no re-evaluation runs.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      expect(evals).toBe(0);
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].parallelism).toBe(false);
    } finally {
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('falls back to the ambient config and skips the gate when the config cannot be evaluated under the task env', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    // An unverified address must not become a gate the daemon then caches, but
    // graph construction must survive the failed evaluation.
    _setChildEval(async () => {
      throw new Error('boom');
    });
    // The plugin warns through emitPluginWorkerLog so the message survives the
    // daemon, where `logger.warn` routes to the daemon log file.
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      // The serve dependency comes from the ambient evaluation; no gate is
      // inferred for the failed chain.
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e-ci--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
      ]);
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
      ]);
      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringMatching(/could not evaluate playwright\.config\.js/)
      );
      expect(warn).toHaveBeenCalledWith('warn', expect.stringMatching(/boom/));
    } finally {
      warn.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('retries the task-env evaluation on the next pass instead of caching the failed fallback', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    let failEval = true;
    let evals = 0;
    installFreshConfigEval(() => {
      evals++;
      if (failEval) {
        throw new Error('boom');
      }
    });
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
      });

      const run = async () =>
        (
          await createNodesFunction(
            ['playwright.config.js'],
            { targetName: 'e2e', ciTargetName: 'e2e-ci' },
            context
          )
        )[0][1].projects['.'].targets;

      // The failure degrades this pass to the ambient config with no gate.
      const first = await run();
      expect(first['e2e--wait-for-webserver']).toBeUndefined();
      expect(evals).toBe(1);

      // Nothing about the failed pass may be cached: a transient fault (a
      // timeout, a fork error) must not permanently disable the gate, so the
      // next pass re-attempts the evaluation and infers the gate.
      failEval = false;
      const second = await run();
      expect(evals).toBe(2);
      expect(second['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
    } finally {
      warn.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('keeps a successful chain gated when only the other chain fails to evaluate', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    installFreshConfigEval((env) => {
      if (env.FAIL_CI === '1') {
        throw new Error('ci-chain boom');
      }
    });
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});

    try {
      await mockPlaywrightConfig(
        tempFs,
        `module.exports = {
  testDir: 'tests',
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.BASE_URL || 'http://localhost:4200',
    reuseExistingServer: true,
  },
};`
      );
      // The ci-only dotenv makes the chains diverge, so each evaluates on its
      // own; the marker makes only the ci evaluation fail.
      await tempFs.createFiles({
        'tests/run-me.spec.ts': '',
        '.env': 'BASE_URL=http://localhost:4301\n',
        '.env.e2e-ci': 'FAIL_CI=1\n',
      });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      // The e2e chain resolved under its task env and keeps its gate.
      expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
        { url: 'http://localhost:4301' },
      ]);
      expect(targets['e2e'].dependsOn).toContainEqual({
        target: 'e2e--wait-for-webserver',
      });
      // The failed ci chain degrades to the ambient serve dependency, no gate.
      expect(targets['e2e-ci--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
      ]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringMatching(/for e2e-ci\b[\s\S]*ci-chain boom/)
      );
    } finally {
      warn.mockRestore();
      _setChildEval(null);
      setWorkspaceRoot(originalWorkspaceRoot);
      if (originalBaseUrl === undefined) {
        delete process.env.BASE_URL;
      } else {
        process.env.BASE_URL = originalBaseUrl;
      }
    }
  });

  it('should not infer a wait-for-webserver task when the webServer has no port or url', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;

    expect(targets['e2e--wait-for-webserver']).toBeUndefined();
    // both tasks fall back to depending on the serve task only, as before.
    expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
    ]);
    expect(targets['e2e'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
    ]);
    expect(project.metadata.targetGroups['E2E (CI)']).not.toContain(
      'e2e--wait-for-webserver'
    );
  });

  it.each([
    { port: 0 },
    { url: '' },
    // Playwright probes the url's port over TCP whenever `port` is defined,
    // which is not the check the readiness task would run.
    { port: 0, url: 'http://127.0.0.1:4200' },
    { port: null, url: 'http://127.0.0.1:4200' },
    // A `playwright.config.js` is not type-checked, so either can arrive as a
    // type Playwright coerces but the readiness task can't probe.
    { port: '4200' as unknown as number },
    { url: 4200 as unknown as string },
  ])(
    'should not infer a wait-for-webserver task when the webServer sets %p',
    async (server) => {
      await mockPlaywrightConfig(tempFs, {
        testDir: 'tests',
        webServer: {
          command: 'npx nx run app1:serve',
          reuseExistingServer: true,
          ...server,
        },
      });
      await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        context
      );
      const project = results[0][1].projects['.'];
      const { targets } = project;

      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
      ]);
      expect(targets['e2e'].dependsOn).toEqual([
        { projects: ['app1'], target: 'serve' },
      ]);
      expect(project.metadata.targetGroups['E2E (CI)']).not.toContain(
        'e2e--wait-for-webserver'
      );
    }
  );

  it('should default the wait-for-webserver timeout to the configured webServer.timeout', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        port: 4200,
        reuseExistingServer: true,
        timeout: 120000,
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options).toEqual({
      servers: [{ port: 4200, timeout: 120000 }],
    });
  });

  it('should keep each configured webServer.timeout on its own server', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: [
        {
          command: 'npx nx run app1:serve',
          port: 4200,
          reuseExistingServer: true,
          timeout: 30000,
        },
        {
          command: 'npx nx run api1:serve',
          port: 3333,
          reuseExistingServer: true,
          timeout: 120000,
        },
      ],
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    // a fast server must not inherit a slower server's budget.
    expect(targets['e2e--wait-for-webserver'].options).toEqual({
      servers: [
        { port: 4200, timeout: 30000 },
        { port: 3333, timeout: 120000 },
      ],
    });
  });

  it('should let the webServerTimeout plugin option override the configured webServer.timeout', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        port: 4200,
        reuseExistingServer: true,
        timeout: 120000,
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
        webServerTimeout: 300000,
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options).toEqual({
      servers: [{ port: 4200, timeout: 120000 }],
      timeout: 300000,
    });
  });

  it('should drop a non-number webServer.timeout an unchecked config can carry', async () => {
    // The gate task's schema rejects a string timeout at run time, so it must
    // not be baked into the target.
    await mockPlaywrightConfig(
      tempFs,
      `module.exports = {
        testDir: 'tests',
        webServer: {
          command: 'npx nx run app1:serve',
          port: 4200,
          reuseExistingServer: true,
          timeout: '120000',
        },
      };`
    );
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
      { port: 4200 },
    ]);
  });

  it('should pass ignoreHTTPSErrors through to the wait-for-webserver task when set', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        url: 'https://localhost:4200',
        ignoreHTTPSErrors: true,
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
      { url: 'https://localhost:4200', ignoreHTTPSErrors: true },
    ]);
  });

  it('should keep the dependency but not gate a webServer command with a trailing configuration', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve:production',
        port: 4200,
        reuseExistingServer: true,
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      { targetName: 'e2e', ciTargetName: 'e2e-ci' },
      context
    );
    const { targets } = results[0][1].projects['.'];

    // The dependency runs the target without the configuration, so the
    // started server may not listen at the configured address; readiness is
    // left to Playwright's own probe.
    expect(targets['e2e--wait-for-webserver']).toBeUndefined();
    expect(targets['e2e'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
    ]);
    expect(targets['e2e-ci--tests/run-me.spec.ts'].dependsOn).toEqual([
      { projects: ['app1'], target: 'serve' },
    ]);
  });

  it('warns when a reuseExistingServer webServer command cannot be inferred', async () => {
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});
    try {
      await mockPlaywrightConfig(tempFs, {
        testDir: 'tests',
        webServer: {
          command: 'npx nx run app1:serve --port=4200',
          port: 4200,
          reuseExistingServer: true,
        },
      });
      await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      // The command was meant to be reused as a task, so its silent drop would
      // read as the feature not working; the skip itself matches master.
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].dependsOn).toBeUndefined();
      expect(targets['e2e'].parallelism).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('npx nx run app1:serve --port=4200')
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('warns for a versioned nx invocation that cannot be inferred', async () => {
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});
    try {
      await mockPlaywrightConfig(tempFs, {
        testDir: 'tests',
        webServer: {
          // `nx@latest` is still an Nx invocation, so its skip warrants the
          // same warning as a bare `nx` one.
          command: 'npx nx@latest run app1:serve --port=4200',
          port: 4200,
          reuseExistingServer: true,
        },
      });
      await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

      await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );

      expect(warn).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('npx nx@latest run app1:serve --port=4200')
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn for a webServer command that is not an Nx invocation', async () => {
    const warn = jest
      .spyOn(devkitInternal, 'emitPluginWorkerLog')
      .mockImplementation(() => {});
    try {
      await mockPlaywrightConfig(tempFs, {
        testDir: 'tests',
        webServer: {
          command: 'npm run start',
          port: 4200,
          reuseExistingServer: true,
        },
      });
      await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

      const results = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );
      const { targets } = results[0][1].projects['.'];

      // A non-Nx command was never meant to map to a task, so the skip is not
      // worth announcing; the serialization guard still applies.
      expect(warn).not.toHaveBeenCalled();
      expect(targets['e2e--wait-for-webserver']).toBeUndefined();
      expect(targets['e2e'].dependsOn).toBeUndefined();
      expect(targets['e2e'].parallelism).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('should not crash on a webServer without a command', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: { port: 4200, reuseExistingServer: true } as any,
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      { targetName: 'e2e', ciTargetName: 'e2e-ci' },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver']).toBeUndefined();
    expect(targets['e2e'].dependsOn).toBeUndefined();
    expect(targets['e2e'].parallelism).toBe(false);
  });

  it('should not gate or depend on a webServer that waits for command output', async () => {
    // Playwright treats a `wait.stdout`/`wait.stderr` server as ready when the
    // regex matches (raced against the address probe) and stores named capture
    // groups in the env, both tied to the process Playwright starts itself. A
    // task-started server would be reused without either, so the server is
    // left entirely to Playwright.
    await mockPlaywrightConfig(
      tempFs,
      `module.exports = {
        testDir: 'tests',
        webServer: [
          { command: 'npx nx run app1:serve', port: 4200, reuseExistingServer: true },
          { command: 'npx nx run worker1:serve', port: 5000, reuseExistingServer: true, wait: { stdout: /ready/ } },
        ],
      };`
    );
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
      { port: 4200 },
    ]);
    expect(targets['e2e'].dependsOn).toContainEqual({
      projects: ['app1'],
      target: 'serve',
    });
    expect(targets['e2e'].dependsOn).not.toContainEqual(
      expect.objectContaining({ projects: expect.arrayContaining(['worker1']) })
    );
    // The wait-based server gets no inferred task, so nothing in the graph
    // starts it; the consuming tasks stay serialized even though the app1
    // dependency was inferred.
    expect(targets['e2e'].parallelism).toBe(false);
    expect(targets['e2e-ci--tests/run-me.spec.ts'].parallelism).toBe(false);
    expect(targets['e2e-ci'].parallelism).toBe(false);
  });

  it('should leave a config whose only webServer waits for command output entirely to Playwright', async () => {
    await mockPlaywrightConfig(
      tempFs,
      `module.exports = {
        testDir: 'tests',
        webServer: {
          command: 'npx nx run app1:serve',
          port: 4200,
          reuseExistingServer: true,
          wait: { stdout: /ready/ },
        },
      };`
    );
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver']).toBeUndefined();
    expect(targets['e2e'].dependsOn).toBeUndefined();
    // Serialized so parallel atomized runs cannot race to start the server.
    expect(targets['e2e'].parallelism).toBe(false);
  });

  it('should not gate or depend on a webServer that sets env, leaving its launch to Playwright', async () => {
    // Only Playwright passes `webServer.env` to the command it starts. A
    // task-started server would run without it, listening at a different
    // address (a PORT) or silently reused missing the env the tests rely on.
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: [
        {
          command: 'npx nx run app1:serve',
          port: 4200,
          reuseExistingServer: true,
        },
        {
          command: 'npx nx run api1:serve',
          url: 'http://localhost:4300',
          reuseExistingServer: true,
          env: { PORT: '4300' },
        },
      ],
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
      { port: 4200 },
    ]);
    expect(targets['e2e'].dependsOn).toContainEqual({
      projects: ['app1'],
      target: 'serve',
    });
    expect(targets['e2e'].dependsOn).not.toContainEqual(
      expect.objectContaining({ projects: expect.arrayContaining(['api1']) })
    );
    // Playwright starts the env-carrying server itself, so nothing in the
    // graph covers it; serialize so parallel atomized runs cannot race it.
    expect(targets['e2e'].parallelism).toBe(false);
    expect(targets['e2e-ci'].parallelism).toBe(false);
  });

  it('should still gate a webServer whose env is empty', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: {
        command: 'npx nx run app1:serve',
        port: 4200,
        reuseExistingServer: true,
        env: {},
      },
    });
    await tempFs.createFiles({ 'tests/run-me.spec.ts': '' });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = results[0][1].projects['.'];

    expect(targets['e2e--wait-for-webserver'].options.servers).toEqual([
      { port: 4200 },
    ]);
    expect(targets['e2e'].dependsOn).toContainEqual({
      projects: ['app1'],
      target: 'serve',
    });
    expect(targets['e2e'].parallelism).toBeUndefined();
  });

  it('should not set parallelism to false and should infer dependsOn using the tasks run in the different webServer.command that have reuseExistingServer set to true', async () => {
    await mockPlaywrightConfig(tempFs, {
      testDir: 'tests',
      webServer: [
        { command: 'npx nx run app1:serve', reuseExistingServer: true },
        { command: 'npx nx run api1:serve', reuseExistingServer: true },
        { command: 'npx nx run api2:dev', reuseExistingServer: true },
        { command: 'npx nx run api3:serve', reuseExistingServer: false }, // this one should not be included in dependsOn
      ],
    });
    await tempFs.createFiles({
      'tests/run-me.spec.ts': '',
      'tests/run-me-2.spec.ts': '',
    });

    const results = await createNodesFunction(
      ['playwright.config.js'],
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const project = results[0][1].projects['.'];
    const { targets } = project;
    expect(targets['e2e']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test",
        "dependsOn": [
          {
            "projects": [
              "app1",
              "api1",
            ],
            "target": "serve",
          },
          {
            "projects": [
              "api2",
            ],
            "target": "dev",
          },
        ],
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
      }
    `);
    expect(targets['e2e-ci']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me-2.spec.ts",
          },
          {
            "options": "forward",
            "params": "forward",
            "target": "e2e-ci--tests/run-me.spec.ts",
          },
        ],
        "executor": "nx:noop",
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "nonAtomizedTarget": "e2e",
          "technologies": [
            "playwright",
          ],
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
      }
    `);
    expect(project.metadata.targetGroups).toMatchInlineSnapshot(`
      {
        "E2E (CI)": [
          "e2e-ci--tests/run-me-2.spec.ts",
          "e2e-ci--tests/run-me.spec.ts",
          "e2e-ci",
          "e2e-ci--merge-reports",
        ],
      }
    `);
    expect(targets['e2e-ci--tests/run-me.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me.spec.ts --output=test-results/tests-run-me-spec-ts",
        "dependsOn": [
          {
            "projects": [
              "app1",
              "api1",
            ],
            "target": "serve",
          },
          {
            "projects": [
              "api2",
            ],
            "target": "dev",
          },
        ],
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {},
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-spec-ts",
        ],
      }
    `);
    expect(targets['e2e-ci--tests/run-me-2.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me-2.spec.ts --output=test-results/tests-run-me-2-spec-ts",
        "dependsOn": [
          {
            "projects": [
              "app1",
              "api1",
            ],
            "target": "serve",
          },
          {
            "projects": [
              "api2",
            ],
            "target": "dev",
          },
        ],
        "inputs": [
          "default",
          "^production",
          "^{projectRoot}/tsconfig*.json",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me-2.spec.ts in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
          "env": {},
        },
        "outputs": [
          "{projectRoot}/test-results/tests-run-me-2-spec-ts",
        ],
      }
    `);
  });

  describe('tsconfig inputs', () => {
    const tsconfigFieldsInput = {
      fields: ['compilerOptions', 'extends', 'files', 'include'],
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should add tsconfig files from the project tsconfig extends chain that live outside the project root', async () => {
      jest
        .spyOn(jsUtils, 'getRootTsConfigFileName')
        .mockReturnValue('tsconfig.base.json');
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({}),
        'tsconfig.shared.json': JSON.stringify({
          extends: './tsconfig.base.json',
        }),
        'apps/my-app/package.json': '{}',
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.shared.json',
        }),
        'apps/my-app/playwright.config.js': 'module.exports = {}',
      });

      const results = await createNodesFunction(
        ['apps/my-app/playwright.config.js'],
        { targetName: 'e2e' },
        context
      );

      const inputs = results[0][1].projects['apps/my-app'].targets.e2e.inputs;
      expect(inputs).toContainEqual({
        ...tsconfigFieldsInput,
        json: '{workspaceRoot}/tsconfig.shared.json',
      });
      // tsconfig.base.json is the root tsconfig (handled by native hasher)
      expect(inputs).not.toContainEqual(
        expect.objectContaining({
          json: '{workspaceRoot}/tsconfig.base.json',
        })
      );
    });

    it('should add the workspace root tsconfig.json when tsconfig.base.json exists (handled by nxE2EPreset at runtime)', async () => {
      jest
        .spyOn(jsUtils, 'getRootTsConfigFileName')
        .mockReturnValue('tsconfig.base.json');
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({}),
        'tsconfig.json': JSON.stringify({
          extends: './tsconfig.base.json',
          files: [],
          include: [],
        }),
        'apps/my-app/package.json': '{}',
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
        }),
        'apps/my-app/playwright.config.js': 'module.exports = {}',
      });

      const results = await createNodesFunction(
        ['apps/my-app/playwright.config.js'],
        { targetName: 'e2e' },
        context
      );

      const inputs = results[0][1].projects['apps/my-app'].targets.e2e.inputs;
      expect(inputs).toContainEqual({
        ...tsconfigFieldsInput,
        json: '{workspaceRoot}/tsconfig.json',
      });
      expect(inputs).not.toContainEqual(
        expect.objectContaining({
          json: '{workspaceRoot}/tsconfig.base.json',
        })
      );
    });

    it('should not add the workspace root tsconfig.json when it is the native hasher file (no tsconfig.base.json)', async () => {
      jest
        .spyOn(jsUtils, 'getRootTsConfigFileName')
        .mockReturnValue('tsconfig.json');
      await tempFs.createFiles({
        'tsconfig.json': JSON.stringify({}),
        'apps/my-app/package.json': '{}',
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.json',
        }),
        'apps/my-app/playwright.config.js': 'module.exports = {}',
      });

      const results = await createNodesFunction(
        ['apps/my-app/playwright.config.js'],
        { targetName: 'e2e' },
        context
      );

      const inputs = results[0][1].projects['apps/my-app'].targets.e2e.inputs;
      expect(inputs).not.toContainEqual(
        expect.objectContaining({
          json: '{workspaceRoot}/tsconfig.json',
        })
      );
    });

    it('should not add tsconfig files inside the project root', async () => {
      jest
        .spyOn(jsUtils, 'getRootTsConfigFileName')
        .mockReturnValue('tsconfig.base.json');
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({}),
        'apps/my-app/package.json': '{}',
        'apps/my-app/tsconfig.e2e.json': JSON.stringify({
          extends: './tsconfig.json',
        }),
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
        }),
        'apps/my-app/playwright.config.js': 'module.exports = {}',
      });

      const results = await createNodesFunction(
        ['apps/my-app/playwright.config.js'],
        { targetName: 'e2e' },
        context
      );

      const inputs = results[0][1].projects['apps/my-app'].targets.e2e.inputs;
      expect(inputs).not.toContainEqual(
        expect.objectContaining({
          json: expect.stringMatching(/apps\/my-app\//),
        })
      );
    });

    it('should add the same tsconfig inputs to the ciTargetName target', async () => {
      jest
        .spyOn(jsUtils, 'getRootTsConfigFileName')
        .mockReturnValue('tsconfig.base.json');
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({}),
        'tsconfig.json': JSON.stringify({
          extends: './tsconfig.base.json',
          files: [],
          include: [],
        }),
        'apps/my-app/package.json': '{}',
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
        }),
        'apps/my-app/playwright.config.js': `module.exports = { testDir: 'e2e' }`,
        'apps/my-app/e2e/a.spec.ts': '',
      });

      const results = await createNodesFunction(
        ['apps/my-app/playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      );

      const targets = results[0][1].projects['apps/my-app'].targets;
      const rootTsconfigInput = {
        ...tsconfigFieldsInput,
        json: '{workspaceRoot}/tsconfig.json',
      };
      expect(targets['e2e'].inputs).toContainEqual(rootTsconfigInput);
      expect(targets['e2e-ci'].inputs).toContainEqual(rootTsconfigInput);
    });
  });
});

async function mockPlaywrightConfig(
  tempFs: TempFs,
  config: PlaywrightTestConfig | string
) {
  await tempFs.writeFile(
    'playwright.config.js',
    typeof config === 'string'
      ? config
      : `module.exports = ${JSON.stringify(config)}`
  );
}

// Clears the named variables so a developer's ambient proxy or TLS env cannot
// leak into the probe-divergence assertions.
function saveEnv(names: string[]): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const name of names) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
