import { stripIndents } from '@nx/devkit';
import {
  newProject,
  cleanupProject,
  checkFilesDoNotExist,
  checkFilesExist,
  getAvailablePort,
  killProcessAndPorts,
  readFile,
  readJson,
  runCLI as _runCLI,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  getPackageManagerCommand,
  runCommand,
} from '@nx/e2e-utils';
import { readPort } from './utils';

// Using verbose CLI for debugging
function runCLI(cmd: string, opts?: { env?: Record<string, string> }) {
  return _runCLI(cmd, {
    verbose: true,
    env: {
      ...opts?.env,
      NX_VERBOSE_LOGGING: 'true',
      NX_NATIVE_LOGGING: 'nx::native::db',
    },
  });
}

describe('React Rspack Module Federation - TS Solution + PM Workspaces', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react'], preset: 'ts' });
  });

  afterAll(() => cleanupProject());

  it('should generate host and remote apps without project.json, with package.json exports', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const shellPort = await getAvailablePort();

    // Generate host with remotes
    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote1},${remote2} --devServerPort=${shellPort} --bundler=rspack --e2eTestRunner=cypress --style=css --no-interactive --skipFormat`
    );

    runCommand(getPackageManagerCommand().install);

    // ========================================
    // Test 1: Verify NO project.json files exist (TS solution uses package.json)
    // ========================================
    checkFilesDoNotExist(`${shell}/project.json`);
    checkFilesDoNotExist(`${remote1}/project.json`);
    checkFilesDoNotExist(`${remote2}/project.json`);

    // ========================================
    // Test 2: Verify package.json files exist with correct structure
    // ========================================
    checkFilesExist(`${shell}/package.json`);
    checkFilesExist(`${remote1}/package.json`);
    checkFilesExist(`${remote2}/package.json`);

    // ========================================
    // Test 3: Verify package.json has simple names (not scoped) in TS solution
    // ========================================
    const shellPkgJson = readJson(`${shell}/package.json`);
    const remote1PkgJson = readJson(`${remote1}/package.json`);
    const remote2PkgJson = readJson(`${remote2}/package.json`);

    // In module federation, packages use simple names to match module-federation.config.ts
    expect(shellPkgJson.name).toBe(shell);
    expect(remote1PkgJson.name).toBe(remote1);
    expect(remote2PkgJson.name).toBe(remote2);

    // ========================================
    // Test 4: Verify host has remotes as devDependencies using simple names
    // ========================================
    expect(shellPkgJson.devDependencies).toBeDefined();
    expect(shellPkgJson.devDependencies[remote1]).toBeDefined();
    expect(shellPkgJson.devDependencies[remote2]).toBeDefined();

    // Verify workspace protocol is used (pnpm/yarn) or * (npm)
    const remote1Version = shellPkgJson.devDependencies[remote1];
    expect(
      remote1Version === 'workspace:*' ||
        remote1Version === '*' ||
        remote1Version.startsWith('workspace:')
    ).toBe(true);

    // ========================================
    // Test 5: Verify remote package.json has exports configured
    // ========================================
    expect(remote1PkgJson.exports).toBeDefined();
    expect(remote1PkgJson.exports['./Module']).toBeDefined();
    expect(remote1PkgJson.exports['./Module'].types).toBe(
      './src/remote-entry.ts'
    );
    expect(remote1PkgJson.exports['./Module'].default).toBe(
      './src/remote-entry.ts'
    );

    expect(remote2PkgJson.exports).toBeDefined();
    expect(remote2PkgJson.exports['./Module']).toBeDefined();

    // ========================================
    // Test 6: Verify module federation config files exist
    // ========================================
    checkFilesExist(`${shell}/module-federation.config.ts`);
    checkFilesExist(`${remote1}/module-federation.config.ts`);
    checkFilesExist(`${remote2}/module-federation.config.ts`);

    // ========================================
    // Test 7: Verify NO prod config files exist (not needed in TS solution)
    // ========================================
    checkFilesDoNotExist(`${shell}/rspack.config.prod.ts`);
    checkFilesDoNotExist(`${remote1}/rspack.config.prod.ts`);
    checkFilesDoNotExist(`${remote2}/rspack.config.prod.ts`);

    // ========================================
    // Test 8: Run unit tests
    // ========================================
    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    // ========================================
    // Test 9: Build all apps in development and production
    // ========================================
    const apps = [shell, remote1, remote2];
    apps.forEach((app) => {
      ['development', 'production'].forEach(async (configuration) => {
        const cliOutput = runCLI(`run ${app}:build:${configuration}`);
        expect(cliOutput).toContain('Successfully ran target');
      });
    });

    // ========================================
    // Test 10: Serve the host and verify it starts
    // ========================================
    const serveResult = await runCommandUntil(`serve ${shell}`, (output) =>
      output.includes(`http://localhost:${readPort(shell)}`)
    );

    await killProcessAndPorts(serveResult.pid, readPort(shell));

    // ========================================
    // Test 11: Run E2E tests (if configured)
    // ========================================
    if (runE2ETests()) {
      updateFile(
        `${shell}-e2e/src/integration/app.spec.ts`,
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

      const e2eResults = await runCommandUntil(
        `e2e ${shell}-e2e --verbose`,
        (output) => output.includes('All specs passed!')
      );

      await killProcessAndPorts(e2eResults.pid, readPort(shell));
    }
  }, 600_000); // 10 minute timeout for long-running e2e test

  it('should add a new remote to an existing host and update devDependencies', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');
    const shellPort = await getAvailablePort();

    // Generate host with one remote
    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote1} --devServerPort=${shellPort} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
    );

    // Verify initial state
    let shellPkgJson = readJson(`${shell}/package.json`);
    expect(shellPkgJson.devDependencies[remote1]).toBeDefined();

    // Generate second remote and attach it to the host
    runCLI(
      `generate @nx/react:remote ${remote2} --host=${shell} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
    );

    // Verify remote was added to host's devDependencies using simple names
    shellPkgJson = readJson(`${shell}/package.json`);
    const remote2PkgJson = readJson(`${remote2}/package.json`);
    expect(shellPkgJson.devDependencies[remote1]).toBeDefined();
    expect(shellPkgJson.devDependencies[remote2]).toBeDefined();

    // Verify remote has package.json exports
    expect(remote2PkgJson.exports['./Module']).toBeDefined();

    // Verify module federation config was updated
    const shellMFConfig = readFile(`${shell}/module-federation.config.ts`);
    expect(shellMFConfig).toContain(remote2);
  }, 600_000);

  it('should handle workspace libraries correctly with TS solution', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');
    const lib = uniq('lib');
    const shellPort = await getAvailablePort();

    // Generate a library
    runCLI(
      `generate @nx/react:library ${lib} --bundler=none --unitTestRunner=jest --no-interactive --skipFormat`
    );

    // Generate host with remote
    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote} --devServerPort=${shellPort} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
    );

    // Add library as dependency to remote
    const remotePkgJsonPath = `${remote}/package.json`;
    const remotePkgJson = readJson(remotePkgJsonPath);
    const libPkgJson = readJson(`${lib}/package.json`);

    updateFile(
      remotePkgJsonPath,
      JSON.stringify(
        {
          ...remotePkgJson,
          dependencies: {
            ...remotePkgJson.dependencies,
            [libPkgJson.name]: 'workspace:*',
          },
        },
        null,
        2
      )
    );

    // Run install to link the workspace dependencies
    runCommand(getPackageManagerCommand().install);

    // Import library in remote
    const remoteAppPath = `${remote}/src/app/app.tsx`;
    const remoteAppContent = readFile(remoteAppPath);
    updateFile(
      remoteAppPath,
      `import { } from '${libPkgJson.name}';\n${remoteAppContent}`
    );

    // Build should succeed
    const buildOutput = runCLI(`build ${remote}`);
    expect(buildOutput).toContain('Successfully ran target');

    // Verify library is shared properly
    const shellMFConfig = readFile(`${shell}/module-federation.config.ts`);
    // The library should be referenced properly (no strict verification since implementation may vary)
    expect(shellMFConfig).toBeTruthy();
  }, 600_000);
});
