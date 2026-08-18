import Module, { createRequire } from 'node:module';
import { readJsonFile } from './fileutils';
import {
  normalizePackageGroup,
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
 * nrwl/nx#35444 and `resolvePackageJsonWithoutCachePollution` below.
 */
function readInstalledPackageJson(
  packageName: string
): InstalledNxPackageJson | null {
  const path = resolvePackageJsonWithoutCachePollution(
    packageName,
    getNxRequirePaths(workspaceRoot)
  );
  if (!path) {
    return null;
  }
  try {
    return readJsonFile<InstalledNxPackageJson>(path);
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

/**
 * Resolve `<packageName>/package.json` via Node's CJS resolver while
 * neutralising both ways `require.resolve(req, { paths })` can lie about
 * the `paths` argument:
 *
 *   1. Process-wide `Module._pathCache` — swapped out for the duration of
 *      the call, so any cache entries written are discarded and any
 *      previously-poisoned entries are not read. Without this, an
 *      in-process load of a second `nx` package (e.g. the temp `nx@latest`
 *      install used by the daemon's AI-agents and console-status checks)
 *      can poison the cache key this call uses and make us read the temp
 *      path instead of the workspace path.
 *
 *   2. Package self-reference — when a file inside package `nx` calls
 *      `require.resolve('nx/...')`, Node returns that calling package's
 *      own file regardless of `paths`. We avoid that by issuing the
 *      resolve from a `createRequire` rooted at a synthetic path that is
 *      outside any package, so the resolver has no "self" to reference
 *      and must honour `paths`.
 *
 * Node's single-threaded synchronous execution means `require.resolve` does
 * not yield, so no other code in the process can observe the swapped cache.
 */
function resolvePackageJsonWithoutCachePollution(
  packageName: string,
  requirePaths: string[]
): string | null {
  // `_pathCache` is an internal Node API not exposed in @types/node.
  const realCache = (Module as any)._pathCache;
  (Module as any)._pathCache = Object.create(null);
  try {
    const detachedRequire = createRequire('/__nx_detached_resolver__/x.js');
    return detachedRequire.resolve(`${packageName}/package.json`, {
      paths: requirePaths,
    });
  } catch {
    return null;
  } finally {
    (Module as any)._pathCache = realCache;
  }
}
