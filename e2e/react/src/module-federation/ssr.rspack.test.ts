import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  killProcessAndPorts,
  newProject,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { readPort, runCLI } from './utils';

describe('React Rspack SSR Module Federation', () => {
  describe('ssr', () => {
    beforeEach(() => {
      newProject({ packages: ['@nx/react'] });
    });

    afterEach(() => cleanupProject());

    it('should generate host and remote apps with ssr', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');
      const remote2 = uniq('remote2');
      const remote3 = uniq('remote3');

      await runCLIAsync(
        `generate @nx/react:host apps/${shell} --ssr --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=rspack --style=css --no-interactive --skipFormat`
      );

      expect(readPort(shell)).toEqual(4000);
      expect(readPort(remote1)).toEqual(4201);
      expect(readPort(remote2)).toEqual(4202);
      expect(readPort(remote3)).toEqual(4203);

      for (const app of [shell, remote1, remote2, remote3]) {
        checkFilesExist(
          `apps/${app}/module-federation.config.ts`,
          `apps/${app}/module-federation.server.config.ts`
        );
        const cliOutput = runCLI(`run ${app}:build`);
        expect(cliOutput).toContain('Successfully ran target');

        await killPorts(readPort(app));
      }
    }, 500_000);

    it('should serve remotes as static when running the host by default', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');
      const remote2 = uniq('remote2');
      const remote3 = uniq('remote3');

      await runCLIAsync(
        `generate @nx/react:host apps/${shell} --ssr --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=rspack --style=css --e2eTestRunner=cypress --no-interactive --skipFormat`
      );

      const serveResult = await runCommandUntil(`serve ${shell}`, (output) =>
        output.includes(`NX Static remotes proxies started successfully`)
      );

      await killProcessAndPorts(serveResult.pid);
    }, 500_000);

    it('should serve remotes as static and they should be able to be accessed from the host', async () => {
      const shell = uniq('shell');
      const remote1 = uniq('remote1');
      const remote2 = uniq('remote2');
      const remote3 = uniq('remote3');

      await runCLIAsync(
        `generate @nx/react:host apps/${shell} --ssr --name=${shell} --remotes=${remote1},${remote2},${remote3} --bundler=rspack --style=css --e2eTestRunner=cypress --no-interactive --skipFormat`
      );

      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

      updateFile(`apps/${shell}-e2e/src/e2e/app.cy.ts`, (content) => {
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
          `e2e ${shell}-e2e --verbose`,
          (output) => output.includes('All specs passed!')
        );
        await killProcessAndPorts(hostE2eResults.pid);
      }
    }, 600_000);
  });
});
