import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'path';

// BASE_URL changes the browser destination; local startup is still required.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4321';
const reportDir = join(
  workspaceRoot,
  'dist',
  'astro-docs',
  'playwright-report'
);

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  reporter: [
    ['list', { printSteps: true }],
    ['html', { outputFolder: reportDir, open: 'never' }],
    [
      'junit',
      {
        // JUnit only respects the outputFile option, and not outputDir or outputFolder
        outputFile: `${reportDir}/test-e2e-nx-cloud.xml`,
      },
    ],
  ],
  globalSetup: require.resolve('./global-setup.e2e.ts'),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
