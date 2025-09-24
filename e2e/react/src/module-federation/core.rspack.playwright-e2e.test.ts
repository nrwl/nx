import { stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject, killProcessAndPorts,
  newProject,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';

describe('React Rspack Module Federation - Playwright', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should generate host and remote apps and use playwright for e2es', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const remote3 = uniq('remote3');

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=rspack --e2eTestRunner=playwright --style=css --no-interactive --skipFormat`
    );

    checkFilesExist(`apps/${shell}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote1}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote2}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote3}/module-federation.config.ts`);

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    updateFile(
      `apps/${shell}-e2e/src/example.spec.ts`,
      stripIndents`
          import { test, expect } from '@playwright/test';
          test('should display welcome message', async ({page}) => {
            await page.goto("/");
            expect(await page.locator('h1').innerText()).toContain('Welcome');
          });

          test('should load remote 1', async ({page}) => {
            await page.goto("/${remote1}");
            expect(await page.locator('h1').innerText()).toContain('${remote1}');
          });

          test('should load remote 2', async ({page}) => {
            await page.goto("/${remote2}");
            expect(await page.locator('h1').innerText()).toContain('${remote2}');
          });

          test('should load remote 3', async ({page}) => {
            await page.goto("/${remote3}");
            expect(await page.locator('h1').innerText()).toContain('${remote3}');
          });
      `
    );

    if (runE2ETests()) {
      const e2eResultsSwc = await runCommandUntil(
        `e2e ${shell}-e2e`,
        (output) => output.includes('Successfully ran target e2e for project')
      );
      await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));
    }
  }, 500_000);
});
