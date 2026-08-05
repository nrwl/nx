import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import * as jsUtils from '@nx/js';
import { PlaywrightTestConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setWorkspaceRoot, workspaceRoot } from 'nx/src/utils/workspace-root';
import * as workspaceContext from 'nx/src/utils/workspace-context';
import { createNodesV2 } from './plugin';
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
function installFreshConfigEval(onEval?: () => void): void {
  _setChildEval(async (configFilePath, wsRoot, env) => {
    onEval?.();
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
      workspaceContext,
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

  it('fails createNodes when the config cannot be evaluated under the task env', async () => {
    const originalBaseUrl = process.env.BASE_URL;
    const originalWorkspaceRoot = workspaceRoot;
    delete process.env.BASE_URL;
    setWorkspaceRoot(tempFs.tempDir);
    // A failed evaluation must surface, not bake a wrong gate into the graph.
    _setChildEval(async () => {
      throw new Error('boom');
    });

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

      const error = await createNodesFunction(
        ['playwright.config.js'],
        { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        context
      ).catch((e) => e);
      const innerMessages = (error.errors ?? [])
        .map(([, e]: [unknown, Error]) => e.message)
        .join('\n');
      expect(innerMessages).toMatch(/could not evaluate/);
      expect(innerMessages).toMatch(/"waitForWebServer": false/);
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
