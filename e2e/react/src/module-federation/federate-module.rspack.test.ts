import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { readPort, runCLI } from './utils';

describe('Federate Module', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject();
  });

  afterAll(() => cleanupProject());
  it('should federate a module from a library and update an existing remote', async () => {
    const lib = uniq('lib');
    const remote = uniq('remote');
    const module = uniq('module');
    const host = uniq('host');

    runCLI(
      `generate @nx/react:host ${host} --remotes=${remote} --bundler=rspack --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    runCLI(`generate @nx/js:lib ${lib} --no-interactive --skipFormat`);

    // Federate Module
    runCLI(
      `generate @nx/react:federate-module ${lib}/src/index.ts --name=${module} --remote=${remote} --remoteDirectory=${remote} --bundler=rspack --no-interactive --skipFormat`
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

    const hostPort = readPort(host);
    const remotePort = readPort(remote);

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

  it('should federate a module from a library and create a remote and serve it recursively', async () => {
    const lib = uniq('lib');
    const remote = uniq('remote');
    const childRemote = uniq('childremote');
    const module = uniq('module');
    const host = uniq('host');

    runCLI(
      `generate @nx/react:host ${host} --remotes=${remote} --bundler=rspack --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    runCLI(`generate @nx/js:lib ${lib} --no-interactive --skipFormat`);

    // Federate Module
    runCLI(
      `generate @nx/react:federate-module ${lib}/src/index.ts --name=${module} --remote=${childRemote} --remoteDirectory=${childRemote} --bundler=rspack --no-interactive --skipFormat`
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

    const hostPort = readPort(host);
    const remotePort = readPort(remote);
    const childRemotePort = readPort(childRemote);

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
        remotePort,
        childRemotePort
      );
    }
  }, 500_000);
});
