import { workspaceRoot, type Tree } from 'nx/src/devkit-exports';
import { valid } from 'semver';
import { formatCatalogError, getCatalogManager } from './catalog';

export function checkAndCleanWithSemver(
  pkgName: string,
  version: string
): string;
export function checkAndCleanWithSemver(
  tree: Tree,
  pkgName: string,
  version: string
): string;
export function checkAndCleanWithSemver(
  treeOrPkgName: Tree | string,
  pkgNameOrVersion: string,
  version?: string
): string {
  const tree = typeof treeOrPkgName === 'string' ? undefined : treeOrPkgName;
  const root = tree?.root ?? workspaceRoot;
  const pkgName =
    typeof treeOrPkgName === 'string' ? treeOrPkgName : pkgNameOrVersion;
  const actualVersion =
    typeof treeOrPkgName === 'string' ? pkgNameOrVersion : version!;
  let newVersion = actualVersion;

  const manager = getCatalogManager(root);
  if (manager.isCatalogReference(actualVersion)) {
    const validation = tree
      ? manager.validateCatalogReference(tree, pkgName, actualVersion)
      : manager.validateCatalogReference(root, pkgName, actualVersion);
    if (!validation.isValid) {
      throw new Error(
        `The catalog reference for ${pkgName} is invalid - (${actualVersion})\n${formatCatalogError(
          validation.error!
        )}`
      );
    }

    const resolvedVersion = tree
      ? manager.resolveCatalogReference(tree, pkgName, actualVersion)
      : manager.resolveCatalogReference(root, pkgName, actualVersion);
    if (!resolvedVersion) {
      throw new Error(
        `Could not resolve catalog reference for package ${pkgName}@${actualVersion}.`
      );
    }

    newVersion = resolvedVersion;
  }

  if (valid(newVersion)) {
    return newVersion;
  }

  if (actualVersion.startsWith('~') || actualVersion.startsWith('^')) {
    newVersion = actualVersion.substring(1);
  }

  if (!valid(newVersion)) {
    throw new Error(
      `The package.json lists a version of ${pkgName} that Nx is unable to validate - (${actualVersion})`
    );
  }

  return newVersion;
}
