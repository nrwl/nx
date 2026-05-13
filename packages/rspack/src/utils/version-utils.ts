import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  backwardCompatibleRspackVersions,
  latestRspackVersions,
  type SupportedRspackMajorVersion,
} from './versions';

const RSPACK_CORE_PACKAGE = '@rspack/core';

function throwUnsupportedRspackVersion(installedMajor: number): never {
  throw new Error(
    `@nx/rspack requires ${RSPACK_CORE_PACKAGE}@>=1.0.0, but found ` +
      `version ${installedMajor}.x installed. Please upgrade ${RSPACK_CORE_PACKAGE} ` +
      `to a supported major (1.x or 2.x).`
  );
}

function cleanVersion(version: string): string | undefined {
  return clean(version) ?? coerce(version)?.version ?? undefined;
}

/**
 * Returns the installed @rspack/core major version from the workspace's
 * package.json, or `undefined` when @rspack/core is not yet installed
 * (fresh-install path). Throws when an unsupported (below-floor) version
 * is detected.
 */
export function getInstalledRspackMajorVersion(
  tree: Tree
): SupportedRspackMajorVersion | undefined {
  const raw = getDependencyVersionFromPackageJson(tree, RSPACK_CORE_PACKAGE);
  if (!raw || raw === 'latest' || raw === 'beta') {
    return undefined;
  }

  const cleaned = cleanVersion(raw);
  if (!cleaned) {
    return undefined;
  }

  const installedMajor = major(cleaned);
  if (installedMajor < 1) {
    throwUnsupportedRspackVersion(installedMajor);
  }
  if (installedMajor === 1 || installedMajor === 2) {
    return installedMajor;
  }
  // Unknown future major — fall through to `undefined` so callers treat it
  // as "no map entry; use latest". A follow-up adds the new major to the map.
  return undefined;
}

/**
 * Returns the installed @rspack/core major version resolved at runtime via
 * `require.resolve`. For use in executors and runtime code where no Tree is
 * available. Returns `null` when @rspack/core can't be resolved. Throws when
 * an unsupported (below-floor) version is detected.
 */
export function getInstalledRspackVersionRuntime(): SupportedRspackMajorVersion | null {
  try {
    const packageJsonPath = require.resolve(
      `${RSPACK_CORE_PACKAGE}/package.json`,
      {
        paths: [process.cwd()],
      }
    );
    const { version } = require(packageJsonPath) as { version: string };
    const cleaned = cleanVersion(version);
    if (!cleaned) {
      return null;
    }
    const installedMajor = major(cleaned);
    if (installedMajor < 1) {
      throwUnsupportedRspackVersion(installedMajor);
    }
    if (installedMajor === 1 || installedMajor === 2) {
      return installedMajor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the version-map entry for the installed major, falling back to the
 * latest supported map when no installed version is detected (fresh install).
 */
export function getRspackVersionsForInstalledMajor(tree: Tree) {
  const installed = getInstalledRspackMajorVersion(tree);
  if (installed === undefined) {
    return latestRspackVersions;
  }
  return backwardCompatibleRspackVersions[installed];
}
