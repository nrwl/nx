import {
  createFile,
  runCLI,
  runE2ETests,
  cleanupProject,
  newProject,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('React Playwright e2e tests', () => {
  let projectName;
  const appName = uniq('pw-react-app');
  const usedInAppLibName = uniq('pw-react-lib');

  beforeAll(async () => {
    projectName = newProject({
      name: uniq('pw-react'),
      packages: ['@nx/react', '@nx/vite', '@nx/playwright'],
    });
    runCLI(
      `generate @nx/react:app ${appName} --e2eTestRunner=playwright --bundler=vite --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('resolves the task dotenv env when baking the web server readiness gate', () => {
    const e2eProject = `${appName}-e2e`;
    const configPath = `${e2eProject}/playwright.config.mts`;
    const gateAddress = 'http://localhost:4301';

    // Write .env before editing the config: the config edit is what triggers
    // the graph recompute, so the dotenv file has to be on disk beforehand.
    createFile(`${e2eProject}/.env`, `BASE_URL=${gateAddress}\n`);
    let originalConfig = '';
    updateFile(configPath, (content) => {
      originalConfig = content;
      return content.replace(/url: 'http:\/\/[^']*'/, 'url: baseURL');
    });

    try {
      const project = JSON.parse(runCLI(`show project ${e2eProject} --json`));
      const gateTarget = Object.keys(project.targets).find((t) =>
        t.endsWith('--wait-for-webserver')
      );
      expect(gateTarget).toBeDefined();
      expect(project.targets[gateTarget].options.servers[0].url).toBe(
        gateAddress
      );
    } finally {
      updateFile(configPath, originalConfig);
      updateFile(`${e2eProject}/.env`, '');
    }
  });

  it('should execute e2e tests using playwright', () => {
    if (runE2ETests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
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
