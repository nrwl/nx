import { stripIndents } from '@nrwl/devkit';
import {
  checkFilesExist,
  killPorts,
  newProject,
  readProjectConfig,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('React MFE', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should generate host and remote apps', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const remote3 = uniq('remote3');

    runCLI(
      `generate @nrwl/react:mfe-host ${shell} --style=css --remotes=${remote1},${remote2},${remote3} --no-interactive`
    );

    checkFilesExist(`apps/${shell}/mfe.config.js`);
    checkFilesExist(`apps/${remote1}/mfe.config.js`);
    checkFilesExist(`apps/${remote2}/mfe.config.js`);

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    updateFile(
      `apps/${shell}/webpack.config.js`,
      stripIndents`
        const withModuleFederation = require('@nrwl/react/module-federation');
        const mfeConfig = require('./mfe.config');

        module.exports = withModuleFederation({
          ...mfeConfig,
          remotes: [
            ['${remote1}', '${remote1}@http://localhost:${readPort(
        remote1
      )}/remoteEntry.js'],
            ['${remote2}', 'http://localhost:${readPort(
        remote2
      )}/remoteEntry.js'],
            ['${remote3}', 'http://localhost:${readPort(remote3)}'],
          ],
        });
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

    const e2eResults = runCLI(`e2e ${shell}-e2e --no-watch`);
    expect(e2eResults).toContain('All specs passed!');
    expect(await killPorts()).toBeTruthy();
  }, 500_000);

  function readPort(appName: string): number {
    const config = readProjectConfig(appName);
    return config.targets.serve.options.port;
  }
});
