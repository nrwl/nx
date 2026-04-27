import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
  reservePorts,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';
import { stripIndents } from 'nx/src/utils/strip-indents';

describe('React Rspack Module Federation Misc - Interoperability', () => {
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
    const [shellPort, remote1Port, remote2Port] = await reservePorts(3);

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=webpack --devServerPort=${shellPort} --e2eTestRunner=cypress --style=css --no-interactive --skipFormat`
    );

    updateJson(`apps/${remote1}/project.json`, (project) => {
      project.targets.serve.options.port = remote1Port;
      return project;
    });

    runCLI(
      `generate @nx/react:remote apps/${remote2} --name=${remote2} --host=${shell} --bundler=rspack --style=css --no-interactive --skipFormat`
    );

    updateJson(`apps/${remote2}/project.json`, (project) => {
      project.targets.serve.options.port = remote2Port;
      return project;
    });

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

    const serveResult = await runCommandUntil(
      `serve ${shell}`,
      (output) => output.includes(`http://localhost:${readPort(shell)}`),
      { timeout: 120000 }
    );

    await killProcessAndPorts(serveResult.pid, readPort(shell));

    if (runE2ETests()) {
      const e2eResultsSwc = await runCommandUntil(
        `e2e ${shell}-e2e --verbose`,
        (output) => output.includes('All specs passed!'),
        { timeout: 120000 }
      );

      await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));
    }
  }, 500_000);

  it('should have interop between rspack host and webpack remote', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const [shellPort, remote1Port, remote2Port] = await reservePorts(3);

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=rspack --devServerPort=${shellPort} --e2eTestRunner=cypress --style=css --no-interactive --skipFormat`
    );

    updateJson(`apps/${remote1}/project.json`, (project) => {
      project.targets.serve.options.port = remote1Port;
      return project;
    });

    runCLI(
      `generate @nx/react:remote apps/${remote2} --name=${remote2} --host=${shell} --bundler=webpack --style=css --no-interactive --skipFormat`
    );

    updateJson(`apps/${remote2}/project.json`, (project) => {
      project.targets.serve.options.port = remote2Port;
      return project;
    });

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
        (output) => output.includes('Successfully ran target e2e'),
        { timeout: 120000 }
      );

      await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));
    }
  }, 500_000);
});
