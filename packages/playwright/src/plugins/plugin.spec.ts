import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';

import { createNodesV2 } from './plugin';
import { PlaywrightTestConfig } from '@playwright/test';

describe('@nx/playwright/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('playwright-plugin');
    await tempFs.createFiles({
      'package.json': '{}',
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
      configFiles: [],
    };
  });

  afterEach(() => {
    // tempFs.cleanup();
    jest.resetModules();
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
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests",
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
                  },
                  "e2e-ci": {
                    "cache": true,
                    "dependsOn": [],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests in CI",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/test-results",
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

  it('should create nodes with reporters configured', async () => {
    await mockPlaywrightConfig(tempFs, {
      reporter: [
        ['list'],
        ['json', { outputFile: 'test-results/report.json' }],
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
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "options": {
                      "cwd": "{projectRoot}",
                    },
                    "outputs": [
                      "{projectRoot}/playwright-report",
                      "{projectRoot}/test-results/report.json",
                      "{projectRoot}/test-results/html",
                      "{projectRoot}/test-results",
                    ],
                  },
                  "e2e-ci": {
                    "cache": true,
                    "dependsOn": [],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@playwright/test",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs Playwright Tests in CI",
                      "technologies": [
                        "playwright",
                      ],
                    },
                    "outputs": [
                      "{projectRoot}/playwright-report",
                      "{projectRoot}/test-results/report.json",
                      "{projectRoot}/test-results/html",
                      "{projectRoot}/test-results",
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
        ],
      }
    `);
    expect(targets['e2e-ci']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          {
            "params": "forward",
            "projects": "self",
            "target": "e2e-ci--tests/run-me-2.spec.ts",
          },
          {
            "params": "forward",
            "projects": "self",
            "target": "e2e-ci--tests/run-me.spec.ts",
          },
        ],
        "executor": "nx:noop",
        "inputs": [
          "default",
          "^production",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in CI",
          "technologies": [
            "playwright",
          ],
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
      }
    `);
    expect(targets['e2e-ci--tests/run-me.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me.spec.ts",
        "inputs": [
          "default",
          "^production",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me.spec.ts in CI",
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
    expect(targets['e2e-ci--tests/run-me-2.spec.ts']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test tests/run-me-2.spec.ts",
        "inputs": [
          "default",
          "^production",
          {
            "externalDependencies": [
              "@playwright/test",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in tests/run-me-2.spec.ts in CI",
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
    expect(targets['e2e-ci--tests/skip-me.spec.ts']).not.toBeDefined();
    expect(targets['e2e-ci--tests/ignored/run-me.spec.ts']).not.toBeDefined();
    expect(targets['e2e-ci--not-tests/run-me.spec.ts']).not.toBeDefined();
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
