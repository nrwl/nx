import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';
import { stripIndents } from 'nx/src/utils/strip-indents';

describe('React Rspack Module Federation Misc', () => {
  describe('Convert To Rspack', () => {
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

      runCLI(
        `generate @nx/react:host ${shell} --remotes=${remote1} --bundler=webpack --e2eTestRunner=playwright --style=css --no-interactive --skipFormat`
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

  describe('Interoperability', () => {
    beforeEach(() => {
      process.env.NX_ADD_PLUGINS = 'false';
      newProject({ packages: ['@nx/react'] });
    });
    afterEach(() => {
      cleanupProject();
      delete process.env.NX_ADD_PLUGINS;
    });

    it('should have interop between webpack host and rspack remote', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');
      const remote2 = uniq('remote2');

      runCLI(
        `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=webpack --e2eTestRunner=cypress --style=css --no-interactive --skipFormat`
      );

      runCLI(
        `generate @nx/react:remote apps/${remote2} --name=${remote2} --host=${shell} --bundler=rspack --style=css --no-interactive --skipFormat`
      );

      updateFile(
        `apps/${shell}-e2e/src/integration/app.spec.ts`,
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
        });
      `
      );

      [shell, remote1, remote2].forEach((app) => {
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
    }, 500_000);

    it('should have interop between rspack host and webpack remote', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');
      const remote2 = uniq('remote2');
      runCLI(
        `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=rspack --e2eTestRunner=cypress --style=css --no-interactive --skipFormat`
      );

      runCLI(
        `generate @nx/react:remote apps/${remote2} --name=${remote2} --host=${shell} --bundler=webpack --style=css --no-interactive --skipFormat`
      );

      updateFile(
        `apps/${shell}-e2e/src/integration/app.cy.ts`,
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

        });
      `
      );

      if (runE2ETests()) {
        const e2eResultsSwc = await runCommandUntil(
          `e2e ${shell}-e2e --verbose`,
          (output) => output.includes('Successfully ran target e2e')
        );

        await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));
      }
    }, 500_000);
  });
});
