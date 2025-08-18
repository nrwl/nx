import { stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  getAvailablePort,
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

// TODO(@Coly010): Please re-enable this when the test is fixed.
xdescribe('React Module Federation', () => {
  describe('Default Configuration', () => {
    beforeAll(() => {
      newProject({ packages: ['@nx/react', '@nx/webpack'] });
    });

    afterAll(() => cleanupProject());

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
        const shellPort = await getAvailablePort();

        runCLI(
          `generate @nx/react:host ${shell} --remotes=${remote1},${remote2},${remote3} --devServerPort=${shellPort} --bundler=webpack --e2eTestRunner=cypress --style=css --no-interactive --skipFormat --js=${js}`
        );

        checkFilesExist(
          `${shell}/module-federation.config.${js ? 'js' : 'ts'}`
        );
        checkFilesExist(
          `${remote1}/module-federation.config.${js ? 'js' : 'ts'}`
        );
        checkFilesExist(
          `${remote2}/module-federation.config.${js ? 'js' : 'ts'}`
        );
        checkFilesExist(
          `${remote3}/module-federation.config.${js ? 'js' : 'ts'}`
        );

        await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
          combinedOutput: expect.stringContaining(
            'Test Suites: 1 passed, 1 total'
          ),
        });

        updateFile(
          `${shell}-e2e/src/integration/app.spec.${js ? 'js' : 'ts'}`,
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
            `e2e ${shell}-e2e --no-watch --verbose`,
            (output) => output.includes('All specs passed!')
          );

          await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));

          const e2eResultsTsNode = await runCommandUntil(
            `e2e ${shell}-e2e --no-watch --verbose`,
            (output) =>
              output.includes('Successfully ran target e2e for project'),
            {
              env: { NX_PREFER_TS_NODE: 'true' },
            }
          );
          await killProcessAndPorts(e2eResultsTsNode.pid, readPort(shell));
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
        `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=webpack --e2eTestRunner=playwright --style=css --no-interactive --skipFormat`
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

        const e2eResultsTsNode = await runCommandUntil(
          `e2e ${shell}-e2e`,
          (output) =>
            output.includes('Successfully ran target e2e for project'),
          {
            env: { NX_PREFER_TS_NODE: 'true' },
          }
        );
        await killProcessAndPorts(e2eResultsTsNode.pid, readPort(shell));
      }
    }, 500_000);

    it('should preserve remotes with query params in the path', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');

      runCLI(
        `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=webpack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
      );

      // Update the remote entry to include query params at the end with remoteEntry in path
      updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
        content.replace(
          `'http://localhost:4201/'`,
          `'http://localhost:4201/remoteEntry.js?param=value'`
        )
      );

      runCLI(`run ${shell}:build:production`);

      // Check the artifact in dist for the remote
      const manifestJson = readJson(`dist/apps/${shell}/mf-manifest.json`);
      const remoteEntry = manifestJson.remotes[0];

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

      // Update the remote entry to include query params at the end without remoteEntry in path
      updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
        content.replace(
          `'http://localhost:4201/remoteEntry.js?param=value'`,
          `'http://localhost:4201?param=newValue'`
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

    describe('ssr', () => {
      it('should generate host and remote apps with ssr', async () => {
        const shell = uniq('shell');
        const remote1 = uniq('remote1');
        const remote2 = uniq('remote2');
        const remote3 = uniq('remote3');

        await runCLIAsync(
          `generate @nx/react:host ${shell} --bundler=webpack --ssr --remotes=${remote1},${remote2},${remote3} --style=css --no-interactive --skipFormat`
        );

        expect(readPort(shell)).toEqual(4200);
        expect(readPort(remote1)).toEqual(4201);
        expect(readPort(remote2)).toEqual(4202);
        expect(readPort(remote3)).toEqual(4203);

        [shell, remote1, remote2, remote3].forEach((app) => {
          checkFilesExist(
            `${app}/module-federation.config.ts`,
            `${app}/module-federation.server.config.ts`
          );
          ['build', 'server'].forEach((target) => {
            ['development', 'production'].forEach(async (configuration) => {
              const cliOutput = runCLI(`run ${app}:${target}:${configuration}`);
              expect(cliOutput).toContain('Successfully ran target');

              await killPorts(readPort(app));
            });
          });
        });
      }, 500_000);

      it('should serve remotes as static when running the host by default', async () => {
        const shell = uniq('shell');
        const remote1 = uniq('remote1');
        const remote2 = uniq('remote2');
        const remote3 = uniq('remote3');

        await runCLIAsync(
          `generate @nx/react:host ${shell} --ssr --bundler=webpack --remotes=${remote1},${remote2},${remote3} --style=css --e2eTestRunner=cypress --no-interactive --skipFormat`
        );

        const serveResult = await runCommandUntil(`serve ${shell}`, (output) =>
          output.includes(`Nx SSR Static remotes proxies started successfully`)
        );

        await killProcessAndPorts(serveResult.pid);
      }, 500_000);

      it('should serve remotes as static and they should be able to be accessed from the host', async () => {
        const shell = uniq('shell');
        const remote1 = uniq('remote1');
        const remote2 = uniq('remote2');
        const remote3 = uniq('remote3');

        await runCLIAsync(
          `generate @nx/react:host ${shell} --bundler=webpack --ssr --remotes=${remote1},${remote2},${remote3} --style=css --e2eTestRunner=cypress --no-interactive --skipFormat`
        );

        const capitalize = (s: string) =>
          s.charAt(0).toUpperCase() + s.slice(1);

        updateFile(`${shell}-e2e/src/e2e/app.cy.ts`, (content) => {
          return `
        describe('${shell}-e2e', () => {
          beforeEach(() => cy.visit('/'));

          it('should display welcome message', () => { 
            expect(cy.get('ul li').should('have.length', 4));
            expect(cy.get('ul li').eq(0).should('have.text', 'Home'));
            expect(cy.get('ul li').eq(1).should('have.text', '${capitalize(
              remote1
            )}'));
            expect(cy.get('ul li').eq(2).should('have.text', '${capitalize(
              remote2
            )}'));
            expect(cy.get('ul li').eq(3).should('have.text', '${capitalize(
              remote3
            )}'));
          });
      });
        `;
        });

        if (runE2ETests()) {
          const hostE2eResults = await runCommandUntil(
            `e2e ${shell}-e2e --no-watch --verbose`,
            (output) => output.includes('All specs passed!')
          );
          await killProcessAndPorts(hostE2eResults.pid);
        }
      }, 600_000);
    });

    it('should should support generating host and remote apps with the new name and root format', async () => {
      const shell = uniq('shell');
      const remote = uniq('remote');

      runCLI(
        `generate @nx/react:host ${shell} --bundler=webpack --no-interactive --skipFormat`
      );
      runCLI(
        `generate @nx/react:remote ${remote} --bundler=webpack --host=${shell} --no-interactive --skipFormat`
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
  });
});
