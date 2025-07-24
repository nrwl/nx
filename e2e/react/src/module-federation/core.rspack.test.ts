import { stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';

describe('React Rspack Module Federation', () => {
  describe('Default Configuration', () => {
    beforeEach(() => {
      newProject({ packages: ['@nx/react'] });
    });

    afterEach(() => cleanupProject());

    it.each`
      js
      ${false}
      ${true}
    `(
      'should generate host and remote apps with "--js=$js"',
      async ({ js }) => {
        const shell = uniq('shell');
        const remote1 = uniq('remote1');
        const remote2 = uniq('remote2');
        const remote3 = uniq('remote3');

        runCLI(
          `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=rspack --e2eTestRunner=cypress --style=css --no-interactive --skipFormat --js=${js}`
        );

        checkFilesExist(
          `apps/${shell}/module-federation.config.${js ? 'js' : 'ts'}`
        );
        checkFilesExist(
          `apps/${remote1}/module-federation.config.${js ? 'js' : 'ts'}`
        );
        checkFilesExist(
          `apps/${remote2}/module-federation.config.${js ? 'js' : 'ts'}`
        );
        checkFilesExist(
          `apps/${remote3}/module-federation.config.${js ? 'js' : 'ts'}`
        );

        await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
          combinedOutput: expect.stringContaining(
            'Test Suites: 1 passed, 1 total'
          ),
        });

        updateFile(
          `apps/${shell}-e2e/src/integration/app.spec.${js ? 'js' : 'ts'}`,
          stripIndents`
        import { getGreeting } from '../support/app.po';

        describe('shell app', () => {
          it('should display welcome message', () => {
            cy.visit('/')
            getGreeting().contains('Welcome ${shell}');
          });

          it('should load remote 1', () => {
            cy.visit('/${remote1}')
            getGreeting().contains('Welcome ${remote1}');
          });

          it('should load remote 2', () => {
            cy.visit('/${remote2}')
            getGreeting().contains('Welcome ${remote2}');
          });

          it('should load remote 3', () => {
            cy.visit('/${remote3}')
            getGreeting().contains('Welcome ${remote3}');
          });
        });
      `
        );

        [shell, remote1, remote2, remote3].forEach((app) => {
          ['development', 'production'].forEach(async (configuration) => {
            const cliOutput = runCLI(`run ${app}:build:${configuration}`);
            expect(cliOutput).toContain('Successfully ran target');
          });
        });

        const serveResult = await runCommandUntil(`serve ${shell}`, (output) =>
          output.includes(`http://localhost:${readPort(shell)}`)
        );

        await killProcessAndPorts(serveResult.pid, readPort(shell));

        if (runE2ETests()) {
          const e2eResultsSwc = await runCommandUntil(
            `e2e ${shell}-e2e --verbose`,
            (output) => output.includes('All specs passed!')
          );

          await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));
        }
      },
      500_000
    );
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
        combinedOutput: expect.stringContaining(
          'Test Suites: 1 passed, 1 total'
        ),
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

    // TODO(Coly010): investigate this failure
    xit('should support generating host and remote apps with the new name and root format', async () => {
      const shell = uniq('shell');
      const remote = uniq('remote');

      runCLI(`generate @nx/react:host ${shell} --no-interactive --skipFormat`);
      runCLI(
        `generate @nx/react:remote ${remote} --host=${shell} --bundler=rspack --no-interactive --skipFormat`
      );

      const shellPort = readPort(shell);
      const remotePort = readPort(remote);

      // check files are generated without the layout directory ("apps/") and
      // using the project name as the directory when no directory is provided
      checkFilesExist(`${shell}/module-federation.config.ts`);
      checkFilesExist(`${remote}/module-federation.config.ts`);

      // check default generated host is built successfully
      const buildOutputSwc = runCLI(`run ${shell}:build:development`);
      expect(buildOutputSwc).toContain('Successfully ran target build');

      const buildOutputTsNode = runCLI(`run ${shell}:build:development`, {
        env: { NX_PREFER_TS_NODE: 'true' },
      });
      expect(buildOutputTsNode).toContain('Successfully ran target build');

      // check serves devRemotes ok
      const shellProcessSwc = await runCommandUntil(
        `serve ${shell} --devRemotes=${remote} --verbose`,
        (output) => {
          return output.includes(
            `All remotes started, server ready at http://localhost:${shellPort}`
          );
        }
      );
      await killProcessAndPorts(
        shellProcessSwc.pid,
        shellPort,
        remotePort + 1,
        remotePort
      );

      const shellProcessTsNode = await runCommandUntil(
        `serve ${shell} --devRemotes=${remote} --verbose`,
        (output) => {
          return output.includes(
            `All remotes started, server ready at http://localhost:${shellPort}`
          );
        },
        {
          env: { NX_PREFER_TS_NODE: 'true' },
        }
      );
      await killProcessAndPorts(
        shellProcessTsNode.pid,
        shellPort,
        remotePort + 1,
        remotePort
      );
    }, 500_000);
    it('should preserve remotes with query params in the path', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');

      runCLI(
        `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
      );

      // Update the remote entry to include query params
      updateFile(`apps/${shell}/module-federation.config.ts`, (content) =>
        content.replace(
          `"${remote1}"`,
          `['${remote1}', 'http://localhost:4201/remoteEntry.js?param=value']`
        )
      );

      runCLI(`run ${shell}:build:production`);

      // Check the artifact in dist for the remote
      const manifestJson = readJson(`dist/apps/${shell}/mf-manifest.json`);
      const remoteEntry = manifestJson.remotes[0]; // There should be only one remote

      expect(remoteEntry).toBeDefined();
      expect(remoteEntry.entry).toContain(
        'http://localhost:4201/remoteEntry.js?param=value'
      );
      expect(manifestJson.remotes).toMatchInlineSnapshot(`
        [
          {
            "alias": "${remote1}",
            "entry": "http://localhost:4201/remoteEntry.js?param=value",
            "federationContainerName": "${remote1}",
            "moduleName": "Module",
          },
        ]
      `);

      // Update the remote entry to include new query params without remoteEntry.js
      updateFile(`apps/${shell}/module-federation.config.ts`, (content) =>
        content.replace(
          'http://localhost:4201/remoteEntry.js?param=value',
          'http://localhost:4201?param=newValue'
        )
      );

      runCLI(`run ${shell}:build:production`);

      // Check the artifact in dist for the remote
      const manifestJsonUpdated = readJson(
        `dist/apps/${shell}/mf-manifest.json`
      );
      const remoteEntryUpdated = manifestJsonUpdated.remotes[0]; // There should be only one remote

      expect(remoteEntryUpdated).toBeDefined();
      expect(remoteEntryUpdated.entry).toContain(
        'http://localhost:4201/remoteEntry.js?param=newValue'
      );
    });
  });
});
