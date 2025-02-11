import { defineConfig, devices } from '@playwright/test';
import isCI = require('is-ci');

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: './src/global-setup.ts',
  globalTeardown: './src/global-teardown.ts',
  testDir: './src',
  outputDir: '../../dist/.playwright/e2e-nx-tui/test-output',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  // how long the entire suite can run, prevent CI from timing out
  globalTimeout: process.env.CI ? 1_800_000 : undefined,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    // how long each page.goto can take before timing out
    navigationTimeout: process.env.CI ? 30_000 : undefined,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    // Configure viewport for consistent snapshots
    viewport: { width: 1200, height: 800 },
  },
  // Store snapshots next to test files
  snapshotPathTemplate: '{testDir}/{testFileDir}/__snapshots__/{arg}{ext}',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
