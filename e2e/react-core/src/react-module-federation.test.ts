import { Tree, stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

describe('React Module Federation', () => {
  let proj: string;
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
    proj = newProject();
  });

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

    checkFilesExist(`apps/${shell}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote1}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote2}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote3}/module-federation.config.ts`);

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    expect(readPort(shell)).toEqual(4200);
    expect(readPort(remote1)).toEqual(4201);
    expect(readPort(remote2)).toEqual(4202);
    expect(readPort(remote3)).toEqual(4203);

    updateFile(
      `apps/${shell}/webpack.config.ts`,
      stripIndents`
        import { composePlugins, withNx, ModuleFederationConfig } from '@nx/webpack';
        import { withReact } from '@nx/react';
        import { withModuleFederation } from '@nx/react/module-federation';
        
        import baseConfig from './module-federation.config';
        
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

    if (runE2ETests()) {
      const e2eResultsSwc = runCLI(`e2e ${shell}-e2e --no-watch --verbose`);
      expect(e2eResultsSwc).toContain('All specs passed!');
      await killPorts(readPort(shell));
      await killPorts(readPort(remote1));
      await killPorts(readPort(remote2));
      await killPorts(readPort(remote3));

      const e2eResultsTsNode = runCLI(`e2e ${shell}-e2e --no-watch --verbose`, {
        env: { NX_PREFER_TS_NODE: 'true' },
      });
      expect(e2eResultsTsNode).toContain('All specs passed!');
      await killPorts(readPort(shell));
      await killPorts(readPort(remote1));
      await killPorts(readPort(remote2));
      await killPorts(readPort(remote3));
    }
  }, 500_000);

  it('should generate host and remote apps with ssr', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const remote3 = uniq('remote3');

    await runCLIAsync(
      `generate @nx/react:host ${shell} --ssr --remotes=${remote1},${remote2},${remote3} --style=css --no-interactive --projectNameAndRootFormat=derived`
    );

    expect(readPort(shell)).toEqual(4200);
    expect(readPort(remote1)).toEqual(4201);
    expect(readPort(remote2)).toEqual(4202);
    expect(readPort(remote3)).toEqual(4203);

    [shell, remote1, remote2, remote3].forEach((app) => {
      checkFilesExist(
        `apps/${app}/module-federation.config.ts`,
        `apps/${app}/module-federation.server.config.ts`
      );
      ['build', 'server'].forEach((target) => {
        ['development', 'production'].forEach((configuration) => {
          const cliOutput = runCLI(`run ${app}:${target}:${configuration}`);
          expect(cliOutput).toContain('Successfully ran target');
        });
      });
    });
  }, 500_000);

  it('should should support generating host and remote apps with the new name and root format', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');
    const shellPort = 4200;

    runCLI(
      `generate @nx/react:host ${shell} --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/react:remote ${remote} --host=${shell} --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${shell}/module-federation.config.ts`);
    checkFilesExist(`${remote}/module-federation.config.ts`);

    // check default generated host is built successfully
    const buildOutputSwc = runCLI(`run ${shell}:build:development`);
    expect(buildOutputSwc).toContain('Successfully ran target build');

    const buildOutputTsNode = runCLI(`run ${shell}:build:development`, {
      env: { NX_PREFER_TS_NODE: 'true' },
    });
    expect(buildOutputTsNode).toContain('Successfully ran target build');

    // check serves devRemotes ok
    const shellProcessSwc = await runCommandUntil(
      `serve ${shell} --devRemotes=${remote} --verbose`,
      (output) => {
        return output.includes(
          `All remotes started, server ready at http://localhost:${shellPort}`
        );
      }
    );
    await killProcessAndPorts(shellProcessSwc.pid, shellPort);

    const shellProcessTsNode = await runCommandUntil(
      `serve ${shell} --devRemotes=${remote} --verbose`,
      (output) => {
        return output.includes(
          `All remotes started, server ready at http://localhost:${shellPort}`
        );
      },
      {
        env: { NX_PREFER_TS_NODE: 'true' },
      }
    );
    await killProcessAndPorts(shellProcessTsNode.pid, shellPort);
  }, 500_000);

  it('should support different versions workspace libs for host and remote', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');
    const lib = uniq('lib');

    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote} --no-interactive --projectNameAndRootFormat=as-provided`
    );

    runCLI(
      `generate @nx/js:lib ${lib} --importPath=@acme/${lib} --publishable=true --no-interactive --projectNameAndRootFormat=as-provided`
    );

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
      const remoteE2eResults = runCLI(`e2e ${remote}-e2e --no-watch --verbose`);
      expect(remoteE2eResults).toContain('All specs passed!');

      // test shell e2e
      // serve remote first
      const remotePort = 4201;
      const remoteProcess = await runCommandUntil(
        `serve ${remote} --no-watch --verbose`,
        (output) => {
          return output.includes(
            `Web Development Server is listening at http://localhost:${remotePort}/`
          );
        }
      );
      const shellE2eResults = runCLI(`e2e ${shell}-e2e --no-watch --verbose`);
      expect(shellE2eResults).toContain('All specs passed!');

      await killProcessAndPorts(remoteProcess.pid, remotePort);
    }
  }, 500_000);

  it('should support host and remote with library type var', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');

    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote} --project-name-and-root-format=as-provided --no-interactive`
    );

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
      const hostE2eResultsSwc = runCLI(`e2e ${shell}-e2e --no-watch --verbose`);
      const remoteE2eResultsSwc = runCLI(
        `e2e ${remote}-e2e --no-watch --verbose`
      );

      expect(hostE2eResultsSwc).toContain('All specs passed!');
      expect(remoteE2eResultsSwc).toContain('All specs passed!');

      const hostE2eResultsTsNode = runCLI(
        `e2e ${shell}-e2e --no-watch --verbose`,
        { env: { NX_PREFER_TS_NODE: 'true' } }
      );
      const remoteE2eResultsTsNode = runCLI(
        `e2e ${remote}-e2e --no-watch --verbose`,
        { env: { NX_PREFER_TS_NODE: 'true' } }
      );

      expect(hostE2eResultsTsNode).toContain('All specs passed!');
      expect(remoteE2eResultsTsNode).toContain('All specs passed!');
    }
  }, 500_000);

  // Federate Module
  describe('Federate Module', () => {
    it('should federate a module from a library and update an existing remote', async () => {
      const lib = uniq('lib');
      const remote = uniq('remote');
      const module = uniq('module');
      const host = uniq('host');

      runCLI(
        `generate @nx/react:host ${host} --remotes=${remote} --no-interactive --projectNameAndRootFormat=as-provided`
      );

      runCLI(
        `generate @nx/js:lib ${lib} --no-interactive --projectNameAndRootFormat=as-provided`
      );

      // Federate Module
      runCLI(
        `generate @nx/react:federate-module ${lib}/src/index.ts --name=${module} --remote=${remote} --no-interactive`
      );

      updateFile(
        `${lib}/src/index.ts`,
        `export { default } from './lib/${lib}';`
      );
      updateFile(
        `${lib}/src/lib/${lib}.ts`,
        `export default function lib() { return 'Hello from ${lib}'; };`
      );

      // Update Host to use the module
      updateFile(
        `${host}/src/app/app.tsx`,
        `
      import * as React from 'react';
      import NxWelcome from './nx-welcome';
      import { Link, Route, Routes } from 'react-router-dom';
      
      import myLib from '${remote}/${module}';

      export function App() {
        return (
          <React.Suspense fallback={null}>
            <div className='remote'>
            My Remote Library:  { myLib() }
            </div>
            <ul>
              <li>
                <Link to="/">Home</Link>
              </li>
            </ul>
            <Routes>
              <Route path="/" element={<NxWelcome title="Host" />} />
            </Routes>
          </React.Suspense>
        );
      }

      export default App;
      `
      );

      // Update e2e test to check the module
      updateFile(
        `${host}-e2e/src/e2e/app.cy.ts`,
        `
      describe('${host}', () => {
        beforeEach(() => cy.visit('/'));
      
        it('should display contain the remote library', () => {
          expect(cy.get('div.remote')).to.exist;
          expect(cy.get('div.remote').contains('My Remote Library: Hello from ${lib}'));
        });
      });
      
      `
      );

      // Build host and remote
      const buildOutput = runCLI(`build ${host}`);
      const remoteOutput = runCLI(`build ${remote}`);

      expect(buildOutput).toContain('Successfully ran target build');
      expect(remoteOutput).toContain('Successfully ran target build');

      if (runE2ETests()) {
        const hostE2eResults = runCLI(`e2e ${host}-e2e --no-watch --verbose`);

        expect(hostE2eResults).toContain('All specs passed!');
      }
    }, 500_000);

    it('should federate a module from a library and create a remote and serve it recursively', async () => {
      const lib = uniq('lib');
      const remote = uniq('remote');
      const childRemote = uniq('childremote');
      const module = uniq('module');
      const host = uniq('host');

      runCLI(
        `generate @nx/react:host ${host} --remotes=${remote} --no-interactive --projectNameAndRootFormat=as-provided`
      );

      runCLI(
        `generate @nx/js:lib ${lib} --no-interactive --projectNameAndRootFormat=as-provided`
      );

      // Federate Module
      runCLI(
        `generate @nx/react:federate-module ${lib}/src/index.ts --name=${module} --remote=${childRemote} --no-interactive`
      );

      updateFile(
        `${lib}/src/index.ts`,
        `export { default } from './lib/${lib}';`
      );
      updateFile(
        `${lib}/src/lib/${lib}.ts`,
        `export default function lib() { return 'Hello from ${lib}'; };`
      );

      // Update Host to use the module
      updateFile(
        `${remote}/src/app/app.tsx`,
        `
      import * as React from 'react';
      import NxWelcome from './nx-welcome';
      
      import myLib from '${childRemote}/${module}';

      export function App() {
        return (
          <React.Suspense fallback={null}>
            <div className='remote'>
            My Remote Library:  { myLib() }
            </div>
            <NxWelcome title="Host" />
          </React.Suspense>
        );
      }

      export default App;
      `
      );

      // Update e2e test to check the module
      updateFile(
        `${host}-e2e/src/e2e/app.cy.ts`,
        `
      describe('${host}', () => {
        beforeEach(() => cy.visit('/${remote}'));
      
        it('should display contain the remote library', () => {
          expect(cy.get('div.remote')).to.exist;
          expect(cy.get('div.remote').contains('My Remote Library: Hello from ${lib}'));
        });
      });
      
      `
      );

      // Build host and remote
      const buildOutput = runCLI(`build ${host}`);
      const remoteOutput = runCLI(`build ${remote}`);

      expect(buildOutput).toContain('Successfully ran target build');
      expect(remoteOutput).toContain('Successfully ran target build');

      if (runE2ETests()) {
        const hostE2eResults = runCLI(`e2e ${host}-e2e --no-watch --verbose`);

        expect(hostE2eResults).toContain('All specs passed!');
      }
    }, 500_000);

    describe('Promised based remotes', () => {
      it('should support promised based remotes', async () => {
        const remote = uniq('remote');
        const host = uniq('host');

        runCLI(
          `generate @nx/react:host ${host} --remotes=${remote} --no-interactive --projectNameAndRootFormat=as-provided --typescriptConfiguration=false`
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
          const hostE2eResults = runCLI(`e2e ${host}-e2e --no-watch --verbose`);
          expect(hostE2eResults).toContain('All specs passed!');

          remoteProcess.kill('SIGKILL');
          await killProcessAndPorts(remoteProcess.pid, 4201);
        }
      }, 500_000);
    });
  });

  function readPort(appName: string): number {
    const config = readJson(join('apps', appName, 'project.json'));
    return config.targets.serve.options.port;
  }
});
