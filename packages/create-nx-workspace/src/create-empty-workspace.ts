import * as ora from 'ora';
import { join } from 'path';
import { CreateWorkspaceOptions } from './create-workspace-options';
import { execAndWait } from './utils/child-process-utils';
import { CnwError } from './utils/error-utils';
import {
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
} from './utils/package-manager';
import { unparse } from './utils/unparse';

/**
 * Create a new Nx workspace
 * @param tmpDir temporary directory to invoke nx cli
 * @param name name of new nx workspace
 * @param packageManager current package manager
 * @param options options to pass to nx cli
 * @returns
 */
export async function createEmptyWorkspace<T extends CreateWorkspaceOptions>(
  tmpDir: string,
  name: string,
  packageManager: PackageManager,
  options: T
): Promise<string> {
  // Ensure to use packageManager for args
  // if it's not already passed in from previous process
  if (!options.packageManager) {
    options.packageManager = packageManager;
  }

  const directory = options.name;

  // Cannot skip install for create-nx-workspace or else it'll fail.
  // Even though --skipInstall is not an option to create-nx-workspace, we pass through extra options to presets.
  // See: https://github.com/nrwl/nx/issues/31834
  delete (options as any).skipInstall;

  const args = unparse({
    ...options,
  }).join(' ');

  const pmc = getPackageManagerCommand(packageManager);

  const command = `new ${args}`;

  const workingDir = process.cwd().replace(/\\/g, '/');
  let nxWorkspaceRoot = `"${workingDir}"`;

  // If path contains spaces there is a problem in Windows for npm@6.
  // In this case we have to escape the wrapping quotes.
  if (
    process.platform === 'win32' &&
    /\s/.test(nxWorkspaceRoot) &&
    packageManager === 'npm'
  ) {
    const pmVersion = +getPackageManagerVersion(packageManager, tmpDir).split(
      '.'
    )[0];
    if (pmVersion < 7) {
      nxWorkspaceRoot = `\\"${nxWorkspaceRoot.slice(1, -1)}\\"`;
    }
  }
  let workspaceSetupSpinner = ora(
    `Creating your workspace in ${directory}`
  ).start();

  try {
    const fullCommand = `${pmc.exec} nx ${command} --nxWorkspaceRoot=${nxWorkspaceRoot}`;
    await execAndWait(fullCommand, tmpDir);

    workspaceSetupSpinner.succeed(
      `Successfully created the workspace: ${directory}`
    );
  } catch (e) {
    workspaceSetupSpinner.fail();
    const message = e instanceof Error ? e.message : String(e);
    throw new CnwError(
      'WORKSPACE_CREATION_FAILED',
      `Failed to create a workspace: ${message}`
    );
  } finally {
    workspaceSetupSpinner.stop();
  }
  return join(workingDir, directory);
}
