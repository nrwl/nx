import {
  checkFilesExist,
  killProcessAndPorts,
  uniq,
  runCommandUntil,
} from '@nx/e2e-utils';
import { readPort, runCLI } from './utils';
import {
  setupCoreWebpackTest,
  cleanupCoreWebpackTest,
} from './core-webpack-setup';

describe('React Module Federation - Webpack Name and Root Format', () => {
  beforeAll(() => {
    setupCoreWebpackTest();
  });

  afterAll(() => cleanupCoreWebpackTest());

  it('should should support generating host and remote apps with the new name and root format', async () => {
    const shell = uniq('shell');
    const remote = uniq('remote');

    runCLI(
      `generate @nx/react:host ${shell} --bundler=webpack --no-interactive --skipFormat`
    );
    runCLI(
      `generate @nx/react:remote ${remote} --bundler=webpack --host=${shell} --no-interactive --skipFormat`
    );

    const shellPort = readPort(shell);
    const remotePort = readPort(remote);

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
    await killProcessAndPorts(
      shellProcessSwc.pid,
      shellPort,
      remotePort + 1,
      remotePort
    );

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
    await killProcessAndPorts(
      shellProcessTsNode.pid,
      shellPort,
      remotePort + 1,
      remotePort
    );
  }, 500_000);
});
