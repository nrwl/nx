import {
  cleanupProject,
  fileExists,
  getAvailablePorts,
  killProcessAndPorts,
  newProject,
  readJson,
  runCommandUntil,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { runCLI } from './utils';

// TODO(@Coly010): Re-enable when fixed
xdescribe('Dynamic Module Federation', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());
  it('should load remote dynamic module', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');
    const [shellPort, remotePort] = await getAvailablePorts(2);

    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote} --devServerPort=${shellPort} --bundler=webpack --e2eTestRunner=cypress --dynamic=true --no-interactive --skipFormat`
    );

    updateJson(`${remote}/project.json`, (project) => {
      project.targets.serve.options.port = remotePort;
      return project;
    });

    // Webpack prod config should not exists when loading dynamic modules
    expect(
      fileExists(`${tmpProjPath()}/${shell}/webpack.config.prod.ts`)
    ).toBeFalsy();
    expect(
      fileExists(
        `${tmpProjPath()}/${shell}/src/assets/module-federation.manifest.json`
      )
    ).toBeTruthy();

    updateJson(
      `${shell}/src/assets/module-federation.manifest.json`,
      (json) => {
        return {
          [remote]: `http://localhost:${remotePort}/mf-manifest.json`,
        };
      }
    );

    const manifest = readJson(
      `${shell}/src/assets/module-federation.manifest.json`
    );
    expect(manifest[remote]).toBeDefined();
    expect(manifest[remote]).toEqual(
      `http://localhost:${remotePort}/mf-manifest.json`
    );

    // update e2e
    updateFile(
      `${shell}-e2e/src/e2e/app.cy.ts`,
      `
        import { getGreeting } from '../support/app.po';

        describe('${shell}', () => {
          beforeEach(() => cy.visit('/'));

          it('should display welcome message', () => {
            getGreeting().contains('Welcome ${shell}');
          });

          it('should navigate to /${remote} from /', () => {
            cy.get('a').contains('${remote[0].toUpperCase()}${remote.slice(
        1
      )}').click();
            cy.url().should('include', '/${remote}');
            getGreeting().contains('Welcome ${remote}');
          });
        });
        `
    );

    // Build host and remote
    const buildOutput = runCLI(`build ${shell}`);
    const remoteOutput = runCLI(`build ${remote}`);

    expect(buildOutput).toContain('Successfully ran target build');
    expect(remoteOutput).toContain('Successfully ran target build');

    if (runE2ETests()) {
      // Serve Remote since it is dynamic and won't be started with the host
      const remoteProcess = await runCommandUntil(
        `serve-static ${remote} --no-watch --verbose`,
        () => {
          return true;
        }
      );
      const hostE2eResultsSwc = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!')
      );

      await killProcessAndPorts(remoteProcess.pid, remotePort);
      await killProcessAndPorts(hostE2eResultsSwc.pid, shellPort);
    }
  }, 500_000);
});
