import { Config } from '@jest/types';
import { existsSync, removeSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { exec, execSync } from 'node:child_process';
import { join } from 'node:path';
import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';
import { runLocalRelease } from '../../scripts/local-registry/populate-storage';

export default async function (globalConfig: Config.ConfigGlobals) {
  try {
    const isVerbose: boolean =
      process.env.NX_VERBOSE_LOGGING === 'true' || !!globalConfig.verbose;

    /**
     * For e2e-ci & macos-local-e2e we populate the verdaccio storage up front, but for other workflows we need
     * to run the full local release process before running tests.
     */
    const requiresLocalRelease =
      !process.env.NX_TASK_TARGET_TARGET?.startsWith('e2e-ci') &&
      !process.env.NX_TASK_TARGET_TARGET?.startsWith('e2e-macos-local');

    const listenAddress = 'localhost';
    const port = process.env.NX_LOCAL_REGISTRY_PORT ?? '4873';
    const registry = `http://${listenAddress}:${port}`;
    const authToken = 'secretVerdaccioToken';

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        await assertLocalRegistryIsRunning(registry);
        break;
      } catch {
        console.log(`Waiting for Local registry to start on ${registry}...`);
      }
    }

    process.env.npm_config_registry = registry;
    execSync(
      `npm config set //${listenAddress}:${port}/:_authToken "${authToken}" --ws=false`,
      {
        windowsHide: false,
      }
    );

    // bun
    process.env.BUN_CONFIG_REGISTRY = registry;
    process.env.BUN_CONFIG_TOKEN = authToken;
    // yarnv1
    process.env.YARN_REGISTRY = registry;
    // yarnv2
    process.env.YARN_NPM_REGISTRY_SERVER = registry;
    process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

    global.e2eTeardown = () => {
      execSync(
        `npm config delete //${listenAddress}:${port}/:_authToken --ws=false`,
        {
          windowsHide: false,
        }
      );
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
        // Always show full release logs on CI, they should only happen once via e2e-ci
        await runLocalRelease(publishVersion, isCI || isVerbose);
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

async function assertLocalRegistryIsRunning(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}
