import { runCLI, runCommandUntil } from '@nx/e2e-utils';

import {
  killProcessAndPorts,
  runE2ETests,
  setupReactModuleFederationSuite,
  updateFile,
} from './core.setup';

describe('React Module Federation - ssr serve', () => {
  setupReactModuleFederationSuite();

  it('should serve remotes as static when running the host by default', async () => {
    const shell = 'shell';
    const remote1 = 'remote1';
    const remote2 = 'remote2';
    const remote3 = 'remote3';

    await runCLI(
      `generate @nx/react:host ${shell} --ssr --bundler=webpack --remotes=${remote1},${remote2},${remote3} --style=css --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    const serveResult = await runCommandUntil(`serve ${shell}`, (output) =>
      output.includes(`Nx SSR Static remotes proxies started successfully`)
    );

    await setupServeHostWithDevRemotes(shell, remote1);
  }, 500_000);

  it('should serve remotes as static and they should be able to be accessed from the host', async () => {
    const shell = 'shell';
    const remote1 = 'remote1';
    const remote2 = 'remote2';
    const remote3 = 'remote3';

    await runCLI(
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
