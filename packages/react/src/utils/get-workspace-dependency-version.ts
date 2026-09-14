import { detectPackageManager, getPackageManagerVersion } from '@nx/devkit';
import { lt } from 'semver';

export function getWorkspaceDependencyVersion(workspaceRoot: string): string {
  const packageManager = detectPackageManager(workspaceRoot);
  // npm and Yarn Classic link workspaces using ordinary semver ranges.
  if (
    packageManager === 'npm' ||
    (packageManager === 'yarn' &&
      lt(getPackageManagerVersion(packageManager, workspaceRoot), '2.0.0'))
  ) {
    return '*';
  }
  return 'workspace:*';
}
