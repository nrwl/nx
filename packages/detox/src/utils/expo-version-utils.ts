import { getDependencyVersionFromPackageJson } from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';

/**
 * Get the installed Expo version from package.json.
 */
export function getInstalledExpoVersion(tree: Tree): string | null {
  const installedExpoVersion = getDependencyVersionFromPackageJson(
    tree,
    'expo'
  );

  if (
    !installedExpoVersion ||
    installedExpoVersion === 'latest' ||
    installedExpoVersion === 'beta'
  ) {
    return null;
  }

  return (
    clean(installedExpoVersion) ?? coerce(installedExpoVersion)?.version ?? null
  );
}

/**
 * Check if the workspace is using Expo v54 or above.
 */
export function isExpoV54OrAbove(tree: Tree): boolean {
  const installedExpoVersion = getInstalledExpoVersion(tree);
  if (!installedExpoVersion) {
    return true; // No Expo installed or new project, default to latest (v54+)
  }
  return major(installedExpoVersion) >= 54;
}
