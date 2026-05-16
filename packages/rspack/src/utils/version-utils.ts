import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { major } from 'semver';
import {
  backwardCompatibleRspackVersions,
  latestRspackVersions,
  type SupportedRspackMajorVersion,
} from './versions';

const RSPACK_CORE_PACKAGE = '@rspack/core';

/**
 * Returns the declared @rspack/core major version from the workspace's
 * package.json when it matches a supported major, or `undefined` otherwise
 * (fresh install, dist tag, unknown major). Below-floor enforcement is
 * handled at generator entry points via `assertSupportedRspackVersion`.
 */
export function getInstalledRspackMajorVersion(
  tree: Tree
): SupportedRspackMajorVersion | undefined {
  const declared = getDeclaredPackageVersion(tree, RSPACK_CORE_PACKAGE);
  if (!declared) {
    return undefined;
  }
  const installedMajor = major(declared);
  return installedMajor in backwardCompatibleRspackVersions
    ? (installedMajor as SupportedRspackMajorVersion)
    : undefined;
}

/**
 * Returns the installed @rspack/core major version resolved at runtime from
 * node_modules. For use in executors and runtime code where no Tree is
 * available. Returns `null` when @rspack/core can't be resolved or the
 * installed major isn't supported.
 */
export function getInstalledRspackVersionRuntime(): SupportedRspackMajorVersion | null {
  const version = getInstalledPackageVersion(RSPACK_CORE_PACKAGE);
  if (!version) {
    return null;
  }
  const installedMajor = major(version);
  return installedMajor in backwardCompatibleRspackVersions
    ? (installedMajor as SupportedRspackMajorVersion)
    : null;
}

/**
 * Returns the version-map entry for the installed major, falling back to the
 * latest supported map when no installed version is detected (fresh install)
 * or the detected major is outside the supported window.
 */
export function getRspackVersionsForInstalledMajor(tree: Tree) {
  const installed = getInstalledRspackMajorVersion(tree);
  if (installed === undefined) {
    return latestRspackVersions;
  }
  return backwardCompatibleRspackVersions[installed];
}
