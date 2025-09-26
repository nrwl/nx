import { checkFilesExist, runCLI } from '@nx/e2e-utils';

import {
  generateHostWithRemotes,
  setupReactModuleFederationSuite,
  setupServeHostWithDevRemotes,
} from './core.setup';

describe('React Rspack Module Federation - new format', () => {
  setupReactModuleFederationSuite();

  it('should support generating host and remote apps with the new name and root format', async () => {
    const { shell, remote1 } = await generateHostWithRemotes({
      js: false,
      bundler: 'rspack',
    });

    const shellPort = readPort(shell);
    const remotePort = readPort(remote1);

    checkFilesExist(`${shell}/module-federation.config.ts`);
    checkFilesExist(`${remote1}/module-federation.config.ts`);

    const buildOutputSwc = runCLI(`run ${shell}:build:development`);
    expect(buildOutputSwc).toContain('Successfully ran target build');

    const buildOutputTsNode = runCLI(`run ${shell}:build:development`, {
      env: { NX_PREFER_TS_NODE: 'true' },
    });
    expect(buildOutputTsNode).toContain('Successfully ran target build');

    const shellProcessSwc = await setupServeHostWithDevRemotes(shell, remote1);
    await killProcessAndPorts(
      shellProcessSwc.pid,
      shellPort,
      remotePort + 1,
      remotePort
    );

    const shellProcessTsNode = await setupServeHostWithDevRemotes(
      shell,
      remote1
    );
    await killProcessAndPorts(
      shellProcessTsNode.pid,
      shellPort,
      remotePort + 1,
      remotePort
    );
  }, 500_000);
});
