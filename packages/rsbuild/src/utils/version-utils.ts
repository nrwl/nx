import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  backwardCompatibleRsbuildVersions,
  latestRsbuildVersions,
  type SupportedRsbuildMajorVersion,
} from './versions';

const RSBUILD_CORE_PACKAGE = '@rsbuild/core';

function throwBelowFloor(installedMajor: number): never {
  throw new Error(
    `@nx/rsbuild requires ${RSBUILD_CORE_PACKAGE}@>=1.0.0, but found version ` +
      `${installedMajor}.x installed. Please upgrade ${RSBUILD_CORE_PACKAGE} ` +
      `to a supported major (1.x).`
  );
}

function throwAboveWindow(installedMajor: number): never {
  throw new Error(
    `@nx/rsbuild does not yet support ${RSBUILD_CORE_PACKAGE}@${installedMajor}.x. ` +
      `Pin ${RSBUILD_CORE_PACKAGE} to a supported major (currently 1.x).`
  );
}

function cleanVersion(version: string): string | undefined {
  return clean(version) ?? coerce(version)?.version ?? undefined;
}

/**
 * Returns the installed @rsbuild/core major version from the workspace's
 * package.json, or `undefined` when @rsbuild/core is not yet installed
 * (fresh-install path). Throws when an unsupported version is detected
 * (below floor or above window).
 */
export function getInstalledRsbuildMajorVersion(
  tree: Tree
): SupportedRsbuildMajorVersion | undefined {
  const raw = getDependencyVersionFromPackageJson(tree, RSBUILD_CORE_PACKAGE);
  if (!raw || raw === 'latest' || raw === 'beta') {
    return undefined;
  }

  const cleaned = cleanVersion(raw);
  if (!cleaned) {
    return undefined;
  }

  const installedMajor = major(cleaned);
  if (installedMajor < 1) {
    throwBelowFloor(installedMajor);
  }
  if (installedMajor > 1) {
    throwAboveWindow(installedMajor);
  }
  return 1;
}

/**
 * Returns the installed @rsbuild/core major version resolved at runtime via
 * `require.resolve`. For use in executors and runtime code where no Tree is
 * available. Returns `null` when @rsbuild/core can't be resolved. Throws
 * when an unsupported version is detected.
 */
export function getInstalledRsbuildVersionRuntime(): SupportedRsbuildMajorVersion | null {
  let packageJsonPath: string;
  try {
    packageJsonPath = require.resolve(`${RSBUILD_CORE_PACKAGE}/package.json`, {
      paths: [process.cwd()],
    });
  } catch {
    return null;
  }
  const { version } = require(packageJsonPath) as { version: string };
  const cleaned = cleanVersion(version);
  if (!cleaned) {
    return null;
  }
  const installedMajor = major(cleaned);
  if (installedMajor < 1) {
    throwBelowFloor(installedMajor);
  }
  if (installedMajor > 1) {
    throwAboveWindow(installedMajor);
  }
  return 1;
}

/**
 * Returns the version-map entry for the installed major, falling back to the
 * latest supported map when no installed version is detected (fresh install).
 */
export function getRsbuildVersionsForInstalledMajor(tree: Tree) {
  const installed = getInstalledRsbuildMajorVersion(tree);
  if (installed === undefined) {
    return latestRsbuildVersions;
  }
  return backwardCompatibleRsbuildVersions[installed];
}
