import {
  isWorkspacesEnabled,
  PackageManager,
} from '../../../utils/package-manager';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getGlobPatternsFromPackageManagerWorkspaces } from '../../../plugins/package-json';
import { globWithWorkspaceContext } from '../../../utils/workspace-context';

export async function getPackagesInPackageManagerWorkspace(
  packageManager: PackageManager
) {
  if (!isWorkspacesEnabled(packageManager, workspaceRoot)) {
    return new Set<string>();
  }
  const patterns = getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot);
  return new Set(await globWithWorkspaceContext(workspaceRoot, patterns));
}

export async function needsInstall(
  packageManager: PackageManager,
  originalPackagesInPackageManagerWorkspaces: Set<string>
) {
  if (!isWorkspacesEnabled(packageManager, workspaceRoot)) {
    return false;
  }

  const updatedPackagesInPackageManagerWorkspaces =
    await getPackagesInPackageManagerWorkspace(packageManager);

  if (
    updatedPackagesInPackageManagerWorkspaces.size !==
    originalPackagesInPackageManagerWorkspaces.size
  ) {
    return true;
  }

  for (const pkg of updatedPackagesInPackageManagerWorkspaces) {
    if (!originalPackagesInPackageManagerWorkspaces.has(pkg)) {
      return true;
    }
  }

  return false;
}
