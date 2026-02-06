import { writeFileSync } from 'fs';
import { dirSync } from 'tmp';
import ora from 'ora';
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
    const logFile = e instanceof CnwError ? e.logFile : undefined;
    const exitCode = e instanceof CnwError ? e.exitCode : undefined;
    const message = e instanceof Error ? e.message : String(e);

    const lines = [`Failed to install dependencies`];
    if (message?.trim()) {
      lines.push(message.trim());
    }
    if (exitCode != null) {
      lines.push(`Exit code: ${exitCode}`);
    }
    if (logFile) {
      lines.push(`Log file: ${logFile}`);
    }
    lines.push(
      `\nPlease verify that "${install}" runs successfully in a temporary directory.`
    );

    throw new CnwError(
      'SANDBOX_FAILED',
      lines.join('\n'),
      logFile,
      exitCode ?? undefined
    );
  } finally {
    installSpinner.stop();
  }

  return tmpDir;
}
