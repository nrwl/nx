import { CreateWorkspaceOptions } from './create-workspace-options';
import { CnwError } from './utils/error-utils';
import {
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
} from './utils/package-manager';
import { spawnAndWait } from './utils/child-process-utils';
import { unparse } from './utils/unparse';

export async function createPreset<T extends CreateWorkspaceOptions>(
  preset: string,
  parsedArgs: T,
  packageManager: PackageManager,
  directory: string
): Promise<void> {
  const { skipGit, commit, nxCloud, ...restArgs } = parsedArgs;

  // Delete verbose because it will conflict with the --quiet flag
  if (!restArgs.verbose) {
    delete restArgs.verbose;
  }

  let args = unparse({
    interactive: true,
    ...restArgs,
  }).join(' ');

  const pmc = getPackageManagerCommand(packageManager);

  const workingDir = process.cwd().replace(/\\/g, '/');
  let nxWorkspaceRoot = `"${workingDir}"`;

  // If path contains spaces there is a problem in Windows for npm@6.
  // In this case we have to escape the wrapping quotes.
  if (
    process.platform === 'win32' &&
    /\s/.test(nxWorkspaceRoot) &&
    packageManager === 'npm'
  ) {
    const pmVersion = +getPackageManagerVersion(
      packageManager,
      workingDir
    ).split('.')[0];
    if (pmVersion < 7) {
      nxWorkspaceRoot = `\\"${nxWorkspaceRoot.slice(1, -1)}\\"`;
    }
  }

  if (
    !(process.env.NX_VERBOSE_LOGGING === 'true' || args.includes('--verbose'))
  ) {
    args = '--quiet ' + args;
  }
  const command = `g ${preset}:preset ${args}`;

  try {
    const [exec, ...args] = pmc.exec.split(' ');
    args.push(
      'nx',
      `--nxWorkspaceRoot=${nxWorkspaceRoot}`,
      ...command.split(' ')
    );
    await spawnAndWait(exec, args, directory);
  } catch (e) {
    throw new CnwError('PRESET_FAILED', `Failed to apply preset: ${preset}`);
  }
}
