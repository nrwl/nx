import { Config } from '@jest/types';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { existsSync, removeSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';
import { runLocalRelease } from '../../scripts/local-registry/populate-storage';

export default async function (globalConfig: Config.ConfigGlobals) {
  try {
    const isVerbose: boolean =
      process.env.NX_VERBOSE_LOGGING === 'true' || !!globalConfig.verbose;

    /**
     * For e2e-ci we populate the verdaccio storage up front, but for other workflows we need
     * to run the full local release process before running tests.
     */
    const requiresLocalRelease =
      !process.env.NX_TASK_TARGET_TARGET?.startsWith('e2e-ci');

    global.e2eTeardown = await startLocalRegistry({
      localRegistryTarget: '@nx/nx-source:local-registry',
      verbose: isVerbose,
      clearStorage: requiresLocalRelease,
    });

    /**
     * Set the published version based on what has previously been loaded into the
     * verdaccio storage.
     */
    if (!requiresLocalRelease) {
      const publishedVersion = await getPublishedVersion();
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
  return new Promise((resolve) => {
    // Resolve the published nx version from verdaccio
    exec('npm view nx@latest version', (error, stdout, stderr) => {
      if (error) {
        return resolve(undefined);
      }
      return resolve(stdout.trim());
    });
  });
}
