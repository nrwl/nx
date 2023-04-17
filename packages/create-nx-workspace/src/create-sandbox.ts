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
import { output } from './utils/output';
import { nxVersion } from './utils/nx/nx-version';
import { mapErrorToBodyLines } from './utils/error-utils';

/**
 * Creates a temporary directory and installs Nx in it.
 * @param packageManager package manager to use
 * @returns directory where Nx is installed
 */
export async function createSandbox(packageManager: PackageManager) {
  const installSpinner = ora(
    `Installing dependencies with ${packageManager}`
  ).start();

  const { install } = getPackageManagerCommand(packageManager);

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

    await execAndWait(install, tmpDir);

    installSpinner.succeed();
  } catch (e) {
    installSpinner.fail();
    if (e instanceof Error) {
      output.error({
        title: `Failed to install dependencies`,
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }
    process.exit(1);
  } finally {
    installSpinner.stop();
  }

  return tmpDir;
}
