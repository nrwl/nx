import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// BASE_URL steers the tests and the webServer probe below. Pointing it at a
// deployed application in CI still starts the local serve dependency Nx infers
// from the command.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4301';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * This is a hand-written CommonJS config (`.ts`, no `type: "module"`), so the
 * preset is given `__filename` to derive report/output paths.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run the Vite dev server before starting the tests. Using an nx command
   * lets the @nx/playwright plugin derive a dependsOn on the serve target. */
  webServer: {
    command: 'npx nx run examples-react-basic:serve',
    url: baseURL,
    reuseExistingServer: true,
    cwd: __dirname,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to also run against Firefox / WebKit.
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
