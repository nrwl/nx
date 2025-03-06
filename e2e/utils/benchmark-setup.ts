// This is exported from /jest/, but doesn't rely on jest itself.
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { existsSync, removeSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';
import { runLocalRelease } from '../../scripts/local-registry/populate-storage';

let teardownFn: (() => void) | undefined;

export async function setup() {
  try {
    const isVerbose: boolean = process.env.NX_VERBOSE_LOGGING === 'true';

    teardownFn = await startLocalRegistry({
      localRegistryTarget: '@nx/nx-source:local-registry',
      verbose: isVerbose,
      clearStorage: true,
    });

    /**
     * Set the published version based on what has previously been loaded into the
     * verdaccio storage.
     */
    const publishedVersion = await getPublishedVersion();
    if (publishedVersion) {
      process.env.PUBLISHED_VERSION = publishedVersion;
    }

    if (process.env.NX_E2E_SKIP_CLEANUP !== 'true' || !existsSync('./build')) {
      if (!isCI) {
        registerTsConfigPaths(join(__dirname, '../../tsconfig.base.json'));
        const { e2eCwd } = await import('./get-env-info');
        removeSync(e2eCwd);
      }
      console.log('Publishing packages to local registry');
      const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
      // Always show full release logs on CI, they should only happen once via e2e-ci
      await runLocalRelease(publishVersion, isCI || isVerbose);
    }
  } catch (err) {
    // Clean up registry if possible after setup related errors
    if (typeof teardownFn === 'function') {
      teardownFn();
      console.log('Killed local registry process due to an error during setup');
    }
    throw err;
  }
}

export function teardown() {
  teardownFn();
}

function getPublishedVersion(): Promise<string | undefined> {
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
