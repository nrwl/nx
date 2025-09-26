import {
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

import { setupModuleFederationSuite } from './module-federation.setup';

describe('Angular Module Federation - federate module recursive remote', () => {
  setupModuleFederationSuite();

  it('should federate a module from a library and create a remote that is served recursively', async () => {
    const lib = uniq('lib');
    const remote = uniq('remote');
    const childRemote = uniq('childremote');
    const module = uniq('module');
    const host = uniq('host');
    const hostPort = 4200;

    runCLI(
      `generate @nx/angular:host ${host} --remotes=${remote} --e2eTestRunner=cypress --no-interactive`
    );

    runCLI(`generate @nx/js:lib ${lib} --no-interactive`);

    runCLI(
      `generate @nx/angular:federate-module ${lib}/src/index.ts --name=${module} --remote=${childRemote} --remoteDirectory=${childRemote} --no-interactive`
    );

    updateFile(`${lib}/src/index.ts`, `export { isEven } from './lib/${lib}';`);
    updateFile(
      `${lib}/src/lib/${lib}.ts`,
      `export function isEven(num: number) { return num % 2 === 0; }`
    );

    updateFile(
      `${remote}/src/app/remote-entry/entry.ts`,
      `
      import { Component } from '@angular/core';
      import { isEven } from '${childRemote}/${module}';

      @Component({
        selector: 'app-${remote}-entry',
        template: \`<div class="childremote">{{title}}</div>\`,
        standalone: true
      })
      export class RemoteEntry {
        title = \`shell is \${isEven(2) ? 'even' : 'odd'}\`;
      }`
    );

    updateFile(
      `${remote}/module-federation.config.ts`,
      `
      import { ModuleFederationConfig } from '@nx/webpack';

      const config: ModuleFederationConfig = {
        name: '${remote}',
        remotes: ['${childRemote}'],
        exposes: {
          './Routes': '${remote}/src/app/remote-entry/entry.routes.ts',
          './Module': '${remote}/src/app/remote-entry/entry.ts',
        },
      };

      export default config;`
    );

    updateFile(
      `${host}-e2e/src/e2e/app.cy.ts`,
      `
      describe('${host}', () => {
        beforeEach(() => cy.visit('/${remote}'));

        it('should display contain the remote library', () => {
          expect(cy.get('div.childremote')).to.exist;
          expect(cy.get('div.childremote').contains('shell is even'));
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
