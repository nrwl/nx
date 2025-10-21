import {
  cleanupProject,
  getAvailablePort,
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { stripIndents } from 'nx/src/utils/strip-indents';
import { readPort } from './utils';
import { setupIndependentDeployabilityTests } from './independent-deployability-rspack-setup';

describe('Independent Deployability - promise based remotes', () => {
  let proj: string;

  beforeAll(() => {
    proj = setupIndependentDeployabilityTests();
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should support promised based remotes', async () => {
    const remote = uniq('remote');
    const host = uniq('host');
    const shellPort = await getAvailablePort();

    runCLI(
      `generate @nx/react:host ${host} --remotes=${remote} --devServerPort=${shellPort} --bundler=rspack --e2eTestRunner=cypress --no-interactive --typescriptConfiguration=false --skipFormat`
    );

    const remotePort = readPort(remote);
    // Update remote to be loaded via script
    updateFile(
      `${remote}/module-federation.config.js`,
      stripIndents`
          module.exports = {
            name: '${remote}',
            library: { type: 'var', name: '${remote}' },
            exposes: {
              './Module': './src/remote-entry.ts',
            },
          };
          `
    );

    updateFile(
      `${remote}/rspack.config.prod.js`,
      `module.exports = require('./rspack.config');`
    );

    // Update host to use promise based remote
    updateFile(
      `${host}/module-federation.config.js`,
      `module.exports = {
          name: '${host}',
          library: { type: 'var', name: '${host}' },
          remotes: [
            [
              '${remote}',
              \`promise new Promise(resolve => {
            const remoteUrl = 'http://localhost:${remotePort}/remoteEntry.js';
            const script = document.createElement('script');
            script.src = remoteUrl;
            script.onload = () => {
              const proxy = {
                get: (request) => window.${remote}.get(request),
                init: (arg) => {
                  try {
                    window.${remote}.init(arg);
                  } catch (e) {
                    console.log('Remote container already initialized');
                  }
                }
              };
              resolve(proxy);
            }
            document.head.appendChild(script);
          })\`,
            ],
          ],
        };
        `
    );

    updateFile(
      `${host}/rspack.config.prod.js`,
      `module.exports = require('./rspack.config');`
    );

    // update e2e
    updateFile(
      `${host}-e2e/src/e2e/app.cy.ts`,
      `
        import { getGreeting } from '../support/app.po';

        describe('${host}', () => {
          beforeEach(() => cy.visit('/'));

          it('should display welcome message', () => {
            getGreeting().contains('Welcome ${host}');
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

    const hostPort = readPort(host);

    // Build host and remote
    const buildOutput = runCLI(`build ${host}`);
    const remoteOutput = runCLI(`build ${remote}`);

    expect(buildOutput).toContain('Successfully ran target build');
    expect(remoteOutput).toContain('Successfully ran target build');

    if (runE2ETests()) {
      const hostE2eResults = await runCommandUntil(
        `e2e ${host}-e2e --verbose`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(
        hostE2eResults.pid,
        hostPort,
        hostPort + 1,
        remotePort
      );
    }
  }, 500_000);
});
