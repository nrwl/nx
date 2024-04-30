import {
  runCLI,
  runE2ETests,
  cleanupProject,
  newProject,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Next Playwright e2e tests', () => {
  let projectName;
  const appName = uniq('pw-next-app');
  const usedInAppLibName = uniq('pw-next-lib');

  beforeAll(async () => {
    projectName = newProject({
      name: uniq('pw-next'),
      packages: ['@nx/next'],
    });
    runCLI(
      `generate @nx/next:app ${appName} --e2eTestRunner=playwright --projectNameAndRootFormat=as-provided --no-interactive`
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

  it('should execute e2e tests using playwright with a library used in the app', () => {
    runCLI(
      `generate @nx/js:library ${usedInAppLibName} --unitTestRunner=none --importPath=@mylib --projectNameAndRootFormat=as-provided --no-interactive`
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
