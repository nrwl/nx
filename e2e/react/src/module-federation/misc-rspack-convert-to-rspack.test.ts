import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  getAvailablePort,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';
import { stripIndents } from 'nx/src/utils/strip-indents';

describe('React Rspack Module Federation Misc - Convert To Rspack', () => {
  beforeAll(() => {
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({ packages: ['@nx/react', '@nx/rspack'] });
  });
  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should generate host and remote apps in webpack, convert to rspack and use playwright for e2es', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const shellPort = await getAvailablePort();

    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote1} --bundler=webpack --devServerPort=${shellPort} --e2eTestRunner=playwright --style=css --no-interactive --skipFormat`
    );

    runCLI(
      `generate @nx/rspack:convert-webpack ${shell} --skipFormat --no-interactive`
    );
    runCLI(
      `generate @nx/rspack:convert-webpack ${remote1} --skipFormat --no-interactive`
    );

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
