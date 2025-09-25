import {
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

import { setupModuleFederationSuite } from './module-federation.setup';

describe('Angular Module Federation - federate module existing remote', () => {
  setupModuleFederationSuite();

  it('should federate a module from a library and update an existing remote', async () => {
    const lib = uniq('lib');
    const remote = uniq('remote');
    const module = uniq('module');
    const host = uniq('host');

    const hostPort = 4200;

    runCLI(
      `generate @nx/angular:host ${host} --remotes=${remote} --e2eTestRunner=cypress --no-interactive`
    );

    runCLI(`generate @nx/js:lib ${lib} --no-interactive`);

    runCLI(
      `generate @nx/angular:federate-module ${lib}/src/index.ts --name=${module} --remote=${remote} --no-interactive`
    );

    updateFile(`${lib}/src/index.ts`, `export { isEven } from './lib/${lib}';`);
    updateFile(
      `${lib}/src/lib/${lib}.ts`,
      `export function isEven(num: number) { return num % 2 === 0; }`
    );

    updateFile(
      `${host}/src/app/app.ts`,
      `
      import { Component } from '@angular/core';
      import { isEven } from '${remote}/${module}';

      @Component({
        selector: 'app-root',
        template: \`<div class="host">{{title}}</div>\`,
        standalone: true
      })
      export class App {
        title = \`shell is \${isEven(2) ? 'even' : 'odd'}\`;
      }`
    );

    updateFile(
      `${host}-e2e/src/e2e/app.cy.ts`,
      `
      describe('${host}', () => {
        beforeEach(() => cy.visit('/'));

        it('should display contain the remote library', () => {
          expect(cy.get('div.host')).to.exist;
          expect(cy.get('div.host').contains('shell is even'));
        });
      });

      `
    );

    const buildHostOutput = runCLI(`build ${host}`);
    expect(buildHostOutput).toContain('Successfully ran target build');
    const buildRemoteOutput = runCLI(`build ${remote}`);
    expect(buildRemoteOutput).toContain('Successfully ran target build');

    if (runE2ETests('cypress')) {
      const e2eProcess = await runCommandUntil(`e2e ${host}-e2e`, (output) =>
        output.includes('All specs passed!')
      );
      await killProcessAndPorts(e2eProcess.pid, hostPort, hostPort + 1);
    }
  }, 500_000);
});
