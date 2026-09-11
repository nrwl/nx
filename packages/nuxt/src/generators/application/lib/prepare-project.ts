import { getPackageManagerCommand, type PackageManager } from '@nx/devkit';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function prepareProject(
  appRoot: string,
  workspaceRoot: string,
  packageManager: PackageManager
) {
  const runInAppDir =
    packageManager !== 'pnpm' ||
    existsSync(join(appRoot, 'node_modules', '.bin', 'nuxi')) ||
    existsSync(join(appRoot, 'node_modules', '.bin', 'nuxi.cmd'));
  const pmc = getPackageManagerCommand(packageManager, workspaceRoot);
  const [command, ...args] = pmc.exec.split(' ');
  // Yarn Classic can change cwd to the parent package before launching nuxi.
  // Always provide the absolute app directory, regardless of binary resolution.
  const rootArgument = process.platform === 'win32' ? `"${appRoot}"` : appRoot;
  execFileSync(command, [...args, 'nuxi', 'prepare', rootArgument], {
    cwd: runInAppDir ? appRoot : workspaceRoot,
    windowsHide: true,
    shell: process.platform === 'win32',
  });
}
