import {
  cleanupProject,
  getAvailablePort,
  killProcessAndPorts,
  newProject,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { stripIndents } from 'nx/src/utils/strip-indents';
import { readPort, runCLI } from './utils';

describe('Independent Deployability', () => {
  let proj: string;
  beforeAll(() => {
    process.env.NX_ADD_PLUGINS = 'false';
    proj = newProject();
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should support promised based remotes', async () => {
    const remote = uniq('remote');
    const host = uniq('host');

    runCLI(
      `generate @nx/react:host ${host} --remotes=${remote} --bundler=webpack --e2eTestRunner=cypress --no-interactive --typescriptConfiguration=false --skipFormat`
    );

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
      `${remote}/webpack.config.prod.js`,
      `module.exports = require('./webpack.config');`
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
            const remoteUrl = 'http://localhost:4201/remoteEntry.js';
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
      `${host}/webpack.config.prod.js`,
      `module.exports = require('./webpack.config');`
    );

    // Update e2e project.json
    updateJson(`${host}-e2e/project.json`, (json) => {
      return {
        ...json,
        targets: {
          ...json.targets,
          e2e: {
            ...json.targets.e2e,
            options: {
              ...json.targets.e2e.options,
              devServerTarget: `${host}:serve-static:production`,
            },
          },
        },
      };
    });

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
    const remotePort = readPort(remote);

    // Build host and remote
    const buildOutput = runCLI(`build ${host}`);
    const remoteOutput = runCLI(`build ${remote}`);

    expect(buildOutput).toContain('Successfully ran target build');
    expect(remoteOutput).toContain('Successfully ran target build');

    if (runE2ETests()) {
      const remoteProcess = await runCommandUntil(
        `serve-static ${remote} --no-watch --verbose`,
        () => {
          return true;
        }
      );
      const hostE2eResults = await runCommandUntil(
        `e2e ${host}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(hostE2eResults.pid, hostPort, hostPort + 1);
      await killProcessAndPorts(remoteProcess.pid, remotePort);
    }
  }, 500_000);

  it('should support different versions workspace libs for host and remote', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');
    const lib = uniq('lib');

    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote} --bundler=webpack --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    runCLI(
      `generate @nx/js:lib ${lib} --importPath=@acme/${lib} --publishable=true --no-interactive --skipFormat`
    );

    const shellPort = readPort(shell);
    const remotePort = readPort(remote);

    updateFile(
      `${lib}/src/lib/${lib}.ts`,
      stripIndents`
      export const version = '0.0.1';
      `
    );

    updateJson(`${lib}/package.json`, (json) => {
      return {
        ...json,
        version: '0.0.1',
      };
    });

    // Update host to use the lib
    updateFile(
      `${shell}/src/app/app.tsx`,
      `
    import * as React from 'react';

    import NxWelcome from './nx-welcome';
    import { version } from '@acme/${lib}';
    import { Link, Route, Routes } from 'react-router-dom';

    const About = React.lazy(() => import('${remote}/Module'));

    export function App() {
      return (
        <React.Suspense fallback={null}>
          <div className="home">
            Lib version: { version }
          </div>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>

            <li>
              <Link to="/About">About</Link>
            </li>
          </ul>
          <Routes>
            <Route path="/" element={<NxWelcome title="home" />} />

            <Route path="/About" element={<About />} />
          </Routes>
        </React.Suspense>
      );
    }

    export default App;`
    );

    // Update remote to use the lib
    updateFile(
      `${remote}/src/app/app.tsx`,
      `// eslint-disable-next-line @typescript-eslint/no-unused-vars

    import styles from './app.module.css';
    import { version } from '@acme/${lib}';

    import NxWelcome from './nx-welcome';

    export function App() {
      return (
        
        <div className='remote'>
          Lib version: { version }
          <NxWelcome title="${remote}" />
        </div>
      );
    }

    export default App;`
    );

    // update remote e2e test to check the version
    updateFile(
      `${remote}-e2e/src/e2e/app.cy.ts`,
      `describe('${remote}', () => {
          beforeEach(() => cy.visit('/'));
        
          it('should check the lib version', () => {
            cy.get('div.remote').contains('Lib version: 0.0.1');
          });
        });        
        `
    );

    // update shell e2e test to check the version
    updateFile(
      `${shell}-e2e/src/e2e/app.cy.ts`,
      `
      describe('${shell}', () => {
        beforeEach(() => cy.visit('/'));

        it('should check the lib version', () => {
          cy.get('div.home').contains('Lib version: 0.0.1');
        });
      });
      `
    );

    if (runE2ETests()) {
      // test remote e2e
      const remoteE2eResults = await runCommandUntil(
        `e2e ${remote}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(remoteE2eResults.pid, remotePort);

      // test shell e2e
      // serve remote first
      const remoteProcess = await runCommandUntil(
        `serve ${remote} --no-watch --verbose`,
        (output) => {
          return output.includes(
            `Web Development Server is listening at http://localhost:${remotePort}/`
          );
        }
      );
      await killProcessAndPorts(remoteProcess.pid, remotePort);
      const shellE2eResults = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(
        shellE2eResults.pid,
        shellPort,
        shellPort + 1,
        remotePort
      );
    }
  }, 500_000);

  it('should support host and remote with library type var', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');
    const shellPort = await getAvailablePort();

    runCLI(
      `generate @nx/react:host ${shell} --devServerPort=${shellPort} --remotes=${remote} --bundler=webpack --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    const remotePort = readPort(remote);

    // update host and remote to use library type var
    updateFile(
      `${shell}/module-federation.config.ts`,
      stripIndents`
      import { ModuleFederationConfig } from '@nx/webpack';

      const config: ModuleFederationConfig = {
        name: '${shell}',
        library: { type: 'var', name: '${shell}' },
        remotes: ['${remote}'],
      };

      export default config;
      `
    );

    updateFile(
      `${shell}/webpack.config.prod.ts`,
      `export { default } from './webpack.config';`
    );

    updateFile(
      `${remote}/module-federation.config.ts`,
      stripIndents`
      import { ModuleFederationConfig } from '@nx/webpack';

      const config: ModuleFederationConfig = {
        name: '${remote}',
        library: { type: 'var', name: '${remote}' },
        exposes: {
          './Module': './src/remote-entry.ts',
        },
      };

      export default config;
      `
    );

    updateFile(
      `${remote}/webpack.config.prod.ts`,
      `export { default } from './webpack.config';`
    );

    // Update host e2e test to check that the remote works with library type var via navigation
    updateFile(
      `${shell}-e2e/src/e2e/app.cy.ts`,
      `
    import { getGreeting } from '../support/app.po';
    
    describe('${shell}', () => {
      beforeEach(() => cy.visit('/'));
    
      it('should display welcome message', () => {
        getGreeting().contains('Welcome ${shell}');
        
      });
    
      it('should navigate to /about from /', () => {
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
      const hostE2eResultsSwc = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(
        hostE2eResultsSwc.pid,
        shellPort,
        shellPort + 1,
        remotePort
      );

      const remoteE2eResultsSwc = await runCommandUntil(
        `e2e ${remote}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!')
      );

      await killProcessAndPorts(remoteE2eResultsSwc.pid, remotePort);

      const hostE2eResultsTsNode = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!'),
        { env: { NX_PREFER_TS_NODE: 'true' } }
      );

      await killProcessAndPorts(
        hostE2eResultsTsNode.pid,
        shellPort,
        shellPort + 1,
        remotePort
      );

      const remoteE2eResultsTsNode = await runCommandUntil(
        `e2e ${remote}-e2e --no-watch --verbose`,
        (output) => output.includes('All specs passed!'),
        { env: { NX_PREFER_TS_NODE: 'true' } }
      );

      await killProcessAndPorts(remoteE2eResultsTsNode.pid, remotePort);
    }
  }, 500_000);
});
