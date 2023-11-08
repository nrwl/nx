import { CreateNodesContext } from '@nx/devkit';

import { createNodes } from './plugin';
import { PlaywrightTestConfig } from '@playwright/test';

describe('@nx/playwright/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;

  beforeEach(async () => {
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: '',
    };
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should create nodes with default playwright configuration', () => {
    mockPlaywrightConfig({});
    const nodes = createNodesFunction(
      'playwright.config.js',
      {
        targetName: 'e2e',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "library",
            "root": ".",
            "targets": {
              "e2e": {
                "cache": true,
                "executor": "@nx/playwright:playwright",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "config": "playwright.config.js",
                },
                "outputs": [
                  "{projectRoot}/test-results",
                ],
              },
            },
          },
        },
      }
    `);
  });

  it('should create nodes with reporters configured', () => {
    mockPlaywrightConfig({
      reporter: [
        ['list'],
        ['json', { outputFile: 'test-results/report.json' }],
        ['html', { outputFolder: 'test-results/html' }],
      ],
    });
    const nodes = createNodesFunction(
      'playwright.config.js',
      {
        targetName: 'e2e',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "library",
            "root": ".",
            "targets": {
              "e2e": {
                "cache": true,
                "executor": "@nx/playwright:playwright",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "config": "playwright.config.js",
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
      }
    `);
  });
});

function mockPlaywrightConfig(config: PlaywrightTestConfig) {
  jest.mock(
    'playwright.config.js',
    () => ({
      default: config,
    }),
    {
      virtual: true,
    }
  );
}
