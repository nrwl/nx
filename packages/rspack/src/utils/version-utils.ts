import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  backwardCompatibleRspackVersions,
  latestRspackVersions,
  type SupportedRspackMajorVersion,
} from './versions';

const RSPACK_CORE_PACKAGE = '@rspack/core';

function cleanVersion(version: string): string | undefined {
  return clean(version) ?? coerce(version)?.version ?? undefined;
}

/**
 * Returns the installed @rspack/core major version from the workspace's
 * package.json when it matches a supported major, or `undefined` otherwise
 * (fresh install, dist tag, unknown major). Below-floor enforcement is
 * handled at generator entry points via `assertSupportedRspackVersion`.
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
  if (installedMajor in backwardCompatibleRspackVersions) {
    return installedMajor as SupportedRspackMajorVersion;
  }
  return undefined;
}

/**
 * Returns the installed @rspack/core major version resolved at runtime via
 * `require.resolve`. For use in executors and runtime code where no Tree is
 * available. Returns `null` when @rspack/core can't be resolved or the
 * installed major isn't supported.
 */
export function getInstalledRspackVersionRuntime(): SupportedRspackMajorVersion | null {
  let packageJsonPath: string;
  try {
    packageJsonPath = require.resolve(`${RSPACK_CORE_PACKAGE}/package.json`, {
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
  if (installedMajor in backwardCompatibleRspackVersions) {
    return installedMajor as SupportedRspackMajorVersion;
  }
  return null;
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
