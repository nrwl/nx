import {
  cleanupProject,
  newProject,
  uniq,
  createFile,
  runCLI,
  packageInstall,
  runCommand,
} from '@nx/e2e/utils';

const TEN_MINS_MS = 600_000;
describe('Playwright E2E Test runner', () => {
  beforeAll(() => {
    newProject({ name: uniq('playwright') });
    packageInstall('@playwright/test', undefined, '^1.30.0', 'dev');
    runCommand('npx playwright install --with-deps');
  });

  afterAll(() => cleanupProject());

  it(
    'should test example app',
    () => {
      //TODO: remove when generators are setup.Need to have basic workspace deps setup
      runCLI(`g @nx/js:init`);
      addSampleProject();

      // NOTE: playwright throws errors if it detects running inside jest process. tmp remove and restore the env var for playwright to run
      const results = runCLI(`e2e demo-e2e`);
      expect(results).toContain('6 passed');
      expect(results).toContain('Successfully ran target e2e for project');
    },
    TEN_MINS_MS
  );
});

// TODO: remove this when there are project generators
function addSampleProject() {
  createFile(
    'apps/demo-e2e/src/example.spec.ts',
    `
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*intro/);
});
`
  );
  createFile(
    'apps/demo-e2e/playwright.config.ts',
    `
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src',
  outputDir: '../../dist/playwright/apps/demo-e2e/output',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    [
      'html',
      {
        outputFolder:
          '../../dist/playwright/apps/demo-e2e/playwright-report',
      },
    ],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like await page.goto('/'). */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
`
  );
  createFile(
    'apps/demo-e2e/project.json',
    JSON.stringify(
      {
        name: 'demo-e2e',
        root: 'apps/demo-e2e',
        sourceRoot: 'apps/demo-e2e/src',
        targets: {
          e2e: {
            executor: '@nx/playwright:playwright',
            options: {},
          },
        },
      },
      null,
      2
    )
  );
}
