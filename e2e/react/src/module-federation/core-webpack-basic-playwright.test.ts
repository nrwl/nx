import { stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  killProcessAndPorts,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';
import {
  setupCoreWebpackTest,
  cleanupCoreWebpackTest,
} from './core-webpack-setup';

describe('React Module Federation - Webpack Basic - Playwright', () => {
  beforeAll(() => {
    setupCoreWebpackTest();
  });

  afterAll(() => cleanupCoreWebpackTest());

  it('should generate host and remote apps and use playwright for e2es', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const remote3 = uniq('remote3');

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=webpack --e2eTestRunner=playwright --style=css --no-interactive --skipFormat`
    );

    checkFilesExist(`apps/${shell}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote1}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote2}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote3}/module-federation.config.ts`);

    // TODO(@jaysoo): Remove these logs once we identify why this test hangs in CI.
    console.log(`[core-webpack-basic-playwright] Running test for ${shell}`);
    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });
    console.log(`[core-webpack-basic-playwright] Test complete`);

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
      console.log(
        `[core-webpack-basic-playwright] Starting e2e (swc) for ${shell}-e2e`
      );
      const e2eResultsSwc = await runCommandUntil(
        `e2e ${shell}-e2e`,
        (output) => output.includes('Successfully ran target e2e for project'),
        { timeout: 120_000 }
      );
      console.log(
        `[core-webpack-basic-playwright] e2e (swc) completed with PID ${e2eResultsSwc.pid}`
      );

      console.log(
        `[core-webpack-basic-playwright] Killing e2eResultsSwc (PID: ${
          e2eResultsSwc.pid
        }, port: ${readPort(shell)})`
      );
      await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));
      console.log(`[core-webpack-basic-playwright] Killed e2eResultsSwc`);

      console.log(
        `[core-webpack-basic-playwright] Starting e2e (ts-node) for ${shell}-e2e`
      );
      const e2eResultsTsNode = await runCommandUntil(
        `e2e ${shell}-e2e`,
        (output) => output.includes('Successfully ran target e2e for project'),
        {
          timeout: 120_000,
          env: { NX_PREFER_TS_NODE: 'true' },
        }
      );
      console.log(
        `[core-webpack-basic-playwright] e2e (ts-node) completed with PID ${e2eResultsTsNode.pid}`
      );

      console.log(
        `[core-webpack-basic-playwright] Killing e2eResultsTsNode (PID: ${
          e2eResultsTsNode.pid
        }, port: ${readPort(shell)})`
      );
      await killProcessAndPorts(e2eResultsTsNode.pid, readPort(shell));
      console.log(
        `[core-webpack-basic-playwright] Killed e2eResultsTsNode - test complete`
      );
    }
  }, 500_000);
});
