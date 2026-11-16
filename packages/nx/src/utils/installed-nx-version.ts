import { readJsonFile } from './fileutils';
import {
  normalizePackageGroup,
  resolveWithoutCachePollution,
  type PackageGroup,
  type PackageJson,
} from './package-json';
import { workspaceRoot } from './workspace-root';
import { getNxRequirePaths } from './installation-directory';

type InstalledNxPackageJson = PackageJson & {
  'ng-update'?: { packageGroup?: PackageGroup };
  'nx-migrations'?: { packageGroup?: PackageGroup };
};

/**
 * Read the installed `packageName` package.json via the cache-shielded
 * resolver. The resolver always reflects the workspace's `node_modules`/PnP
 * store rather than whichever copy happens to be loaded in the current process
 * (e.g. the temp `nx@latest` install used by the migrate bootstrap). See
 * nrwl/nx#35444 and `resolveWithoutCachePollution`.
 */
function readInstalledPackageJson(
  packageName: string
): InstalledNxPackageJson | null {
  try {
    return readJsonFile<InstalledNxPackageJson>(
      resolveWithoutCachePollution(
        `${packageName}/package.json`,
        getNxRequirePaths(workspaceRoot)
      )
    );
  } catch {
    return null;
  }
}

/**
 * Resolve the workspace's installed version of `packageName`, or `null` if it
 * cannot be located.
 */
export function getInstalledVersion(packageName: string): string | null {
  return readInstalledPackageJson(packageName)?.version ?? null;
}

/**
 * Resolve the workspace's installed `nx` version, or `null` if no installed
 * `nx` can be located.
 */
export function getInstalledNxVersion(): string | null {
  return getInstalledVersion('nx');
}

/**
 * Resolve the workspace's installed `@nrwl/workspace` version (legacy-era
 * fallback for `nx migrate --include=optional` targeting `< 14.0.0-beta.0`),
 * or `null` if it cannot be resolved from the workspace require paths.
 */
export function getInstalledLegacyNrwlWorkspaceVersion(): string | null {
  return getInstalledVersion('@nrwl/workspace');
}

/**
 * Return the package names declared in the installed `packageName` package's
 * `ng-update.packageGroup` (or `nx-migrations.packageGroup`), plus
 * `packageName` itself. Returns a set containing only `packageName` when the
 * package isn't installed or the metadata is missing.
 */
export function getInstalledPackageGroup(packageName: string): Set<string> {
  const set = new Set<string>([packageName]);
  const pkg = readInstalledPackageJson(packageName);
  if (!pkg) {
    return set;
  }
  const declared =
    pkg['ng-update']?.packageGroup ?? pkg['nx-migrations']?.packageGroup;
  if (declared) {
    for (const entry of normalizePackageGroup(declared)) {
      set.add(entry.package);
    }
  }
  return set;
}
