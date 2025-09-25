import { checkFilesExist, runCLI, runCommandUntil } from '@nx/e2e-utils';

import {
  setupReactModuleFederationSuite,
  setupServeHostWithDevRemotes,
} from './core.setup';

describe('React Module Federation - new format', () => {
  setupReactModuleFederationSuite();

  it('should should support generating host and remote apps with the new name and root format', async () => {
    const shell = 'shell';
    const remote = 'remote';

    runCLI(
      `generate @nx/react:host ${shell} --bundler=webpack --no-interactive --skipFormat`
    );
    runCLI(
      `generate @nx/react:remote ${remote} --bundler=webpack --host=${shell} --no-interactive --skipFormat`
    );

    const shellPort = readPort(shell);
    const remotePort = readPort(remote);

    checkFilesExist(`${shell}/module-federation.config.ts`);
    checkFilesExist(`${remote}/module-federation.config.ts`);

    const buildOutputSwc = runCLI(`run ${shell}:build:development`);
    expect(buildOutputSwc).toContain('Successfully ran target build');

    const buildOutputTsNode = runCLI(`run ${shell}:build:development`, {
      env: { NX_PREFER_TS_NODE: 'true' },
    });
    expect(buildOutputTsNode).toContain('Successfully ran target build');

    const shellProcessSwc = await setupServeHostWithDevRemotes(shell, remote);
    await killProcessAndPorts(
      shellProcessSwc.pid,
      shellPort,
      remotePort + 1,
      remotePort
    );

    const shellProcessTsNode = await setupServeHostWithDevRemotes(
      shell,
      remote
    );
    await killProcessAndPorts(
      shellProcessTsNode.pid,
      shellPort,
      remotePort + 1,
      remotePort
    );
  }, 500_000);
});
