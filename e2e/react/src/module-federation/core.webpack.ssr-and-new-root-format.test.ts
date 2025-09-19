import {
  checkFilesExist,
  cleanupProject,
  killProcessAndPorts,
  killPorts,
  newProject,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';

describe('React Module Federation - Webpack - SSR & new root format', () => {
  beforeAll(() => newProject({ packages: ['@nx/react', '@nx/webpack'] }));
  afterAll(() => cleanupProject());

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

      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

    checkFilesExist(`${shell}/module-federation.config.ts`);
    checkFilesExist(`${remote}/module-federation.config.ts`);

    const buildOutputSwc = runCLI(`run ${shell}:build:development`);
    expect(buildOutputSwc).toContain('Successfully ran target build');

    const buildOutputTsNode = runCLI(`run ${shell}:build:development`, {
      env: { NX_PREFER_TS_NODE: 'true' },
    });
    expect(buildOutputTsNode).toContain('Successfully ran target build');

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
