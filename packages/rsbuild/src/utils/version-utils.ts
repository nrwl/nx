import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { major } from 'semver';
import {
  backwardCompatibleRsbuildVersions,
  latestRsbuildVersions,
  type SupportedRsbuildMajorVersion,
} from './versions';

const RSBUILD_CORE_PACKAGE = '@rsbuild/core';

/**
 * Returns the declared @rsbuild/core major version from the workspace's
 * package.json when it matches a supported major, or `undefined` otherwise
 * (fresh install, dist tag, unknown major). Below-floor enforcement is
 * handled at generator entry points via `assertSupportedRsbuildVersion`.
 */
export function getInstalledRsbuildMajorVersion(
  tree: Tree
): SupportedRsbuildMajorVersion | undefined {
  const declared = getDeclaredPackageVersion(tree, RSBUILD_CORE_PACKAGE);
  if (!declared) {
    return undefined;
  }
  const installedMajor = major(declared);
  return installedMajor in backwardCompatibleRsbuildVersions
    ? (installedMajor as SupportedRsbuildMajorVersion)
    : undefined;
}

/**
 * Returns the installed @rsbuild/core major version resolved at runtime from
 * node_modules. For use in executors and runtime code where no Tree is
 * available. Returns `null` when @rsbuild/core can't be resolved or the
 * installed major isn't supported.
 */
export function getInstalledRsbuildVersionRuntime(): SupportedRsbuildMajorVersion | null {
  const version = getInstalledPackageVersion(RSBUILD_CORE_PACKAGE);
  if (!version) {
    return null;
  }
  const installedMajor = major(version);
  return installedMajor in backwardCompatibleRsbuildVersions
    ? (installedMajor as SupportedRsbuildMajorVersion)
    : null;
}

/**
 * Returns the version-map entry for the installed major, falling back to the
 * latest supported map when no installed version is detected (fresh install)
 * or the detected major is outside the supported window.
 */
export function getRsbuildVersionsForInstalledMajor(tree: Tree) {
  const installed = getInstalledRsbuildMajorVersion(tree);
  if (installed === undefined) {
    return latestRsbuildVersions;
  }
  return backwardCompatibleRsbuildVersions[installed];
}
