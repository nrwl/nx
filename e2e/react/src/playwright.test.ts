import {
  runCLI,
  runE2ETests,
  cleanupProject,
  newProject,
  uniq,
  updateFile,
  readFile,
} from '@nx/e2e/utils';

describe('React Playwright e2e tests', () => {
  let projectName;
  const appName = uniq('pw-react-app');
  const usedInAppLibName = uniq('pw-react-lib');

  beforeAll(async () => {
    projectName = newProject({
      name: uniq('pw-react'),
      packages: ['@nx/react'],
    });
    runCLI(
      `generate @nx/react:app ${appName} --e2eTestRunner=playwright --bundler=vite --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('should execute e2e tests using playwright', () => {
    if (runE2ETests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
  });

  it('should generate a playwright config with the default options', () => {
    const testAppName = uniq('pw-test-app');
    runCLI(
      `generate @nx/react:app ${testAppName} --e2eTestRunner=playwright --bundler=vite --no-interactive`
    );

    const configContent = readFile(`${testAppName}-e2e/playwright.config.ts`);

    //  imports
    expect(configContent).toContain(
      "import { defineConfig, devices } from '@playwright/test';"
    );
    expect(configContent).toContain(
      "import { nxE2EPreset } from '@nx/playwright/preset';"
    );
    expect(configContent).toContain(
      "import { workspaceRoot } from '@nx/devkit';"
    );

    //  baseURL configuration
    expect(configContent).toContain(
      "const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';"
    );

    // defineConfig
    expect(configContent).toContain('export default defineConfig({');
    expect(configContent).toContain(
      "...nxE2EPreset(__filename, { testDir: './src' })"
    );

    //  webServer configuration
    expect(configContent).toContain('use: {');
    expect(configContent).toContain('baseURL,');
    expect(configContent).toContain("trace: 'on-first-retry',");

    expect(configContent).toContain('webServer: {');
    expect(configContent).toContain(
      `command: 'npx nx run ${testAppName}:preview'`
    );
    expect(configContent).toContain("url: 'http://localhost:4200'");
    expect(configContent).toContain('reuseExistingServer: true');
    expect(configContent).toContain('cwd: workspaceRoot');
  });

  it('should execute e2e tests using playwright with a library used in the app', () => {
    runCLI(
      `generate @nx/js:library ${usedInAppLibName} --unitTestRunner=none --importPath=@mylib --no-interactive`
    );

    updateFile(
      `${appName}-e2e/src/example.spec.ts`,
      `
    import { test, expect } from '@playwright/test';
    import * as mylib from '@mylib'

    test('has title', async ({ page }) => {
      await page.goto('/');

      // Expect h1 to contain a substring.
      expect(await page.locator('h1').innerText()).toContain('Welcome');
    });
    `
    );

    if (runE2ETests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
  });
});
