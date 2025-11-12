import { workspaceRoot, type Tree } from 'nx/src/devkit-exports';
import { valid } from 'semver';
import { getCatalogManager } from './catalog/index.js';

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
  let newVersion =
    typeof treeOrPkgName === 'string' ? pkgNameOrVersion : version!;

  const manager = getCatalogManager(root);
  if (manager?.isCatalogReference(newVersion)) {
    try {
      if (tree) {
        manager.validateCatalogReference(tree, pkgName, newVersion);
      } else {
        manager.validateCatalogReference(root, pkgName, newVersion);
      }
    } catch (error) {
      throw new Error(
        `The catalog reference for ${pkgName} is invalid - (${newVersion})\n${error.message}`
      );
    }

    const resolvedVersion = tree
      ? manager.resolveCatalogReference(tree, pkgName, newVersion)
      : manager.resolveCatalogReference(root, pkgName, newVersion);
    if (!resolvedVersion) {
      throw new Error(
        `Could not resolve catalog reference for package ${pkgName}@${newVersion}.`
      );
    }

    newVersion = resolvedVersion;
  }

  if (valid(newVersion)) {
    return newVersion;
  }

  if (newVersion.startsWith('~') || newVersion.startsWith('^')) {
    newVersion = newVersion.substring(1);
  }

  if (!valid(newVersion)) {
    throw new Error(
      `The package.json lists a version of ${pkgName} that Nx is unable to validate - (${newVersion})`
    );
  }

  return newVersion;
}
