import * as ora from 'ora';
import { join } from 'path';
import { CreateWorkspaceOptions } from './create-workspace-options';
import { execAndWait } from './utils/child-process-utils';
import { mapErrorToBodyLines } from './utils/error-utils';
import { output } from './utils/output';
import {
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
} from './utils/package-manager';
import { getFileName } from './utils/string-utils';
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

  options.name = getFileName(name);
  const directory = options.name;

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
    const pmVersion = +getPackageManagerVersion(packageManager).split('.')[0];
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
      `Successfully created the workspace: ${directory}.`
    );
  } catch (e) {
    workspaceSetupSpinner.fail();
    if (e instanceof Error) {
      output.error({
        title: `Failed to create a workspace.`,
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }
    process.exit(1);
  } finally {
    workspaceSetupSpinner.stop();
  }
  return join(workingDir, directory);
}
