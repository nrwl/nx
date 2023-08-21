import { stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readProjectConfig,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('React Module Federation', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));

  afterAll(() => cleanupProject());

  it('should generate host and remote apps', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const remote3 = uniq('remote3');

    runCLI(`generate @nx/react:host ${shell} --style=css --no-interactive`);
    runCLI(
      `generate @nx/react:remote ${remote1} --style=css --host=${shell} --no-interactive`
    );
    runCLI(
      `generate @nx/react:remote ${remote2} --style=css --host=${shell} --no-interactive`
    );
    runCLI(
      `generate @nx/react:remote ${remote3} --style=css --host=${shell} --no-interactive`
    );

    checkFilesExist(`apps/${shell}/module-federation.config.js`);
    checkFilesExist(`apps/${remote1}/module-federation.config.js`);
    checkFilesExist(`apps/${remote2}/module-federation.config.js`);
    checkFilesExist(`apps/${remote3}/module-federation.config.js`);

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    expect(readPort(shell)).toEqual(4200);
    expect(readPort(remote1)).toEqual(4201);
    expect(readPort(remote2)).toEqual(4202);
    expect(readPort(remote3)).toEqual(4203);

    updateFile(
      `apps/${shell}/webpack.config.js`,
      stripIndents`
        import { ModuleFederationConfig } from '@nx/devkit';
        import { composePlugins, withNx } from '@nx/webpack';
        import { withReact } from '@nx/react';
        import { withModuleFederation } from '@nx/react/module-federation');
        
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

  it('should should support generating host and remote apps with the new name and root format', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');

    runCLI(
      `generate @nx/react:host ${shell} --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/react:remote ${remote} --host=${shell} --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${shell}/module-federation.config.js`);
    checkFilesExist(`${remote}/module-federation.config.js`);

    // check default generated host is built successfully
    const buildOutput = runCLI(`run ${shell}:build:development`);
    expect(buildOutput).toContain('Successfully ran target build');
  }, 500_000);

  async function readPort(appName: string): Promise<number> {
    const config = await readProjectConfig(appName);
    return config.targets.serve.options.port;
  }
});
