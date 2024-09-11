import { defineConfig, devices } from '@playwright/test';

/*
 * NOTE: We're not using the `nxE2EPreset` from `@nx/playwright` because there is an issue with `nx-ignore` + nx repo + crystal.
 *
 * The problem is specific to Nx repo, because of the following incompatible combination:
 * 1. `nx-ignore` only installs nx + necessary plugins (as defined in nx.json).
 * 2. `@nx/playwright/plugin` registers tsconfig-paths, thus `@nx/devkit` and `nx` packages are read from source
 *    e.g. packages/devkit rather than node_modules/@nx/devkit
 * 3. When `@nx/playwright/plugin` reads this config file (playwright.config.ts), it eventually loads `packages/devkit` instead of `node_modules/@nx/devkit`.
 *
 * Then, you will see an error like this:
 * Unable to create nodes for nx-dev/nx-dev-e2e/playwright.config.ts using plugin @nx/playwright/plugin.
 * 	 Inner Error: Error: Cannot find module 'fs-extra'
 * Require stack:
 * - /vercel/path0/packages/nx/src/project-graph/nx-deps-cache.ts
 * - /vercel/path0/packages/nx/src/project-graph/project-graph.ts
 * - /vercel/path0/packages/nx/src/config/workspaces.ts
 * - /vercel/path0/packages/nx/src/devkit-exports.ts
 * - /vercel/path0/packages/devkit/index.ts
 *
 * Again, this is specific to Nx repo only, because we both install nx + plugins to node_modules, but they are also mapped to source in tsconfig paths.
 */

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src',
  outputDir: '../../dist/.playwright/nx-dev-e2e/test-output',
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
    baseURL,
    // how long each page.goto can take before timing out
    navigationTimeout: process.env.CI ? 30_000 : undefined,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm exec nx run nx-dev:start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
