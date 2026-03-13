import { Config } from '@jest/types';
import { existsSync, removeSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { ChildProcess, exec, execSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';

export default async function (globalConfig: Config.ConfigGlobals) {
  try {
    const isVerbose: boolean =
      process.env.NX_VERBOSE_LOGGING === 'true' || !!globalConfig.verbose;

    /**
     * For e2e-ci, e2e-local and macos-local-e2e we populate the verdaccio storage up front, but for other workflows we need
     * to run the full local release process before running tests.
     */
    const prefixes = ['e2e-ci', 'e2e-macos-local', 'e2e-local'];
    const requiresLocalRelease = !prefixes.some((prefix) =>
      process.env.NX_TASK_TARGET_TARGET?.startsWith(prefix)
    );

    const listenAddress = 'localhost';
    const port = process.env.NX_LOCAL_REGISTRY_PORT ?? '4873';
    const registry = `http://${listenAddress}:${port}`;
    const authToken = 'secretVerdaccioToken';

    // When running outside of Nx (e.g. Jest directly), start verdaccio ourselves
    let verdaccioProcess: ChildProcess | undefined;
    if (requiresLocalRelease && !(await isLocalRegistryRunning(registry))) {
      console.log(
        `Local registry not detected at ${registry}, starting verdaccio...`
      );
      verdaccioProcess = spawn(
        'npx',
        [
          'verdaccio',
          '--config',
          '.verdaccio/config.yml',
          '--listen',
          `${listenAddress}:${port}`,
        ],
        { stdio: 'ignore', detached: true }
      );
    }

    process.env.npm_config_registry = registry;
    // Use environment variable instead of npm config command to avoid polluting other tests
    process.env[`npm_config_//${listenAddress}:${port}/:_authToken`] =
      authToken;

    // bun
    process.env.BUN_CONFIG_REGISTRY = registry;
    process.env.BUN_CONFIG_TOKEN = authToken;
    // yarnv1
    process.env.YARN_REGISTRY = registry;
    // yarnv2
    process.env.YARN_NPM_REGISTRY_SERVER = registry;
    process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

    process.env.NX_SKIP_PROVENANCE_CHECK = 'true';

    global.e2eTeardown = () => {
      // Clean up environment variable instead of npm config command
      delete process.env[`npm_config_//${listenAddress}:${port}/:_authToken`];
      // Kill verdaccio if we started it
      if (verdaccioProcess) {
        verdaccioProcess.kill();
        verdaccioProcess = undefined;
      }
    };

    /**
     * Set the published version based on what has previously been loaded into the
     * verdaccio storage.
     */
    if (!requiresLocalRelease) {
      let publishedVersion = await getPublishedVersion();
      console.log(`Testing Published version: Nx ${publishedVersion}`);
      if (publishedVersion) {
        process.env.PUBLISHED_VERSION = publishedVersion;
      }
    }

    if (process.env.NX_E2E_SKIP_CLEANUP !== 'true' || !existsSync('./build')) {
      if (!isCI) {
        registerTsConfigPaths(join(__dirname, '../../tsconfig.base.json'));
        const { e2eCwd } = await import('./get-env-info');
        removeSync(e2eCwd);
      }
      if (requiresLocalRelease) {
        console.log('Publishing packages to local registry');
        const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
        const verbose = isCI || isVerbose;
        const releaseCommand = `pnpm nx-release --local ${publishVersion}`;
        console.log(`> ${releaseCommand}`);
        await new Promise<void>((resolve, reject) => {
          const child = exec(releaseCommand, {
            maxBuffer: 1024 * 1000000,
            windowsHide: false,
          });
          if (verbose) {
            child.stdout?.pipe(process.stdout);
            child.stderr?.pipe(process.stderr);
          }
          child.on('exit', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Local release failed with exit code ${code}`));
            }
          });
        });
      }
    }
  } catch (err) {
    // Clean up registry if possible after setup related errors
    if (typeof global.e2eTeardown === 'function') {
      global.e2eTeardown();
      console.log('Killed local registry process due to an error during setup');
    }
    throw err;
  }
}

function getPublishedVersion(): Promise<string | undefined> {
  execSync(`npm config get registry`, {
    stdio: 'inherit',
  });
  return new Promise((resolve) => {
    // Resolve the published nx version from verdaccio
    exec(
      'npm view nx@latest version',
      {
        windowsHide: false,
      },
      (error, stdout, stderr) => {
        if (error) {
          return resolve(undefined);
        }
        return resolve(stdout.trim());
      }
    );
  });
}

async function isLocalRegistryRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
