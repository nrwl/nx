import { stripIndents } from '@nrwl/devkit';
import {
  checkFilesExist,
  cleanupProject,
  killPort,
  newProject,
  readProjectConfig,
  runCLI,
  runCLIAsync,
  runCypressTests,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('React Module Federation', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));

  afterAll(() => cleanupProject());

  it('should generate host and remote apps', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const remote3 = uniq('remote3');

    runCLI(`generate @nrwl/react:host ${shell} --style=css --no-interactive`);
    runCLI(
      `generate @nrwl/react:remote ${remote1} --style=css --host=${shell} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:remote ${remote2} --style=css --host=${shell} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:remote ${remote3} --style=css --host=${shell} --no-interactive`
    );

    checkFilesExist(`apps/${shell}/module-federation.config.js`);
    checkFilesExist(`apps/${remote1}/module-federation.config.js`);
    checkFilesExist(`apps/${remote2}/module-federation.config.js`);
    checkFilesExist(`apps/${remote3}/module-federation.config.js`);

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    updateFile(
      `apps/${shell}/webpack.config.js`,
      stripIndents`
        import { ModuleFederationConfig } from '@nrwl/devkit';
        import { composePlugins, withNx } from '@nrwl/webpack';
        import { withReact } from '@nrwl/react';
        import { withModuleFederation } from '@nrwl/react/module-federation');
        
        const baseConfig = require('./module-federation.config');
        
        const config: ModuleFederationConfig = {
          ...baseConfig,
              remotes: [
                '${remote1}',
                ['${remote2}', 'http://localhost:${readPort(
        remote2
      )}/remoteEntry.js'],
                ['${remote3}', 'http://localhost:${readPort(remote3)}'],
              ],
        };

        // Nx plugins for webpack to build config object from Nx options and context.
        module.exports = composePlugins(withNx(), withReact(), withModuleFederation(config));
      `
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

          it('should load remote 3', () => {
            cy.visit('/${remote3}')
            getGreeting().contains('Welcome ${remote3}');
          });
        });
      `
    );
    // TODO(caleb): cypress isn't able to find the element and then throws error with an address already in use error.
    // https://staging.nx.app/runs/ASAokpXhnE/task/e2e-react:e2e
    // if (runCypressTests()) {
    //   const e2eResults = runCLI(`e2e ${shell}-e2e --no-watch --verbose`);
    //   expect(e2eResults).toContain('All specs passed!');
    //   expect(
    //     await killPorts([
    //       readPort(shell),
    //       readPort(remote1),
    //       readPort(remote2),
    //       readPort(remote3),
    //     ])
    //   ).toBeTruthy();
    // }
  }, 500_000);

  function readPort(appName: string): number {
    const config = readProjectConfig(appName);
    return config.targets.serve.options.port;
  }
});

function killPorts(ports: number[]): Promise<boolean[]> {
  return Promise.all(ports.map((p) => killPort(p)));
}
