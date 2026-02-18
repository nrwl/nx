import { writeFileSync } from 'fs';
import { dirSync } from 'tmp';
import * as ora from 'ora';
import { join } from 'path';

import {
  generatePackageManagerFiles,
  getPackageManagerCommand,
  PackageManager,
} from './utils/package-manager';
import { execAndWait } from './utils/child-process-utils';
import { nxVersion } from './utils/nx/nx-version';
import { CnwError } from './utils/error-utils';

/**
 * Creates a temporary directory and installs Nx in it.
 * @param packageManager package manager to use
 * @returns directory where Nx is installed
 */
export async function createSandbox(packageManager: PackageManager) {
  const installSpinner = ora(
    `Installing dependencies with ${packageManager}`
  ).start();

  const { install, preInstall } = getPackageManagerCommand(packageManager);

  const tmpDir = dirSync().name;
  try {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          nx: nxVersion,
          '@nx/workspace': nxVersion,
        },
        license: 'MIT',
      })
    );
    generatePackageManagerFiles(tmpDir, packageManager);

    if (preInstall) {
      await execAndWait(preInstall, tmpDir);
    }

    await execAndWait(install, tmpDir);

    installSpinner.succeed();
  } catch (e) {
    installSpinner.fail();
    const message = e instanceof Error ? e.message : String(e);
    throw new CnwError(
      'SANDBOX_FAILED',
      `Failed to install dependencies: ${message}`
    );
  } finally {
    installSpinner.stop();
  }

  return tmpDir;
}
