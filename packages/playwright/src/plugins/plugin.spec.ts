import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';

import { createNodes } from './plugin';
import { PlaywrightTestConfig } from '@playwright/test';

describe('@nx/playwright/plugin', () => {
  let createNodesFunction = createNodes[1];
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
    };
  });

  afterEach(() => {
    // tempFs.cleanup();
    jest.resetModules();
  });

  it('should create nodes with default playwright configuration', async () => {
    await mockPlaywrightConfig(tempFs, {});
    const { projects } = await createNodesFunction(
      'playwright.config.js',
      {
        targetName: 'e2e',
      },
      context
    );

    expect(projects).toMatchInlineSnapshot(`
      {
        ".": {
          "root": ".",
          "targets": {
            "e2e": {
              "cache": true,
              "command": "playwright test",
              "inputs": [
                "default",
                "^production",
              ],
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
              ],
              "outputs": [
                "{projectRoot}/test-results",
              ],
            },
          },
        },
      }
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
    const { projects } = await createNodesFunction(
      'playwright.config.js',
      {
        targetName: 'e2e',
      },
      context
    );

    expect(projects).toMatchInlineSnapshot(`
      {
        ".": {
          "root": ".",
          "targets": {
            "e2e": {
              "cache": true,
              "command": "playwright test",
              "inputs": [
                "default",
                "^production",
              ],
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
              ],
              "outputs": [
                "{projectRoot}/playwright-report",
                "{projectRoot}/test-results/report.json",
                "{projectRoot}/test-results/html",
                "{projectRoot}/test-results",
              ],
            },
          },
        },
      }
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

    const { projects } = await createNodesFunction(
      'playwright.config.js',
      {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      context
    );
    const { targets } = projects['.'];
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
        ],
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
        ],
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
        ],
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
