import Module, { createRequire } from 'node:module';
import { readJsonFile } from './fileutils';
import type { PackageJson } from './package-json';
import { workspaceRoot } from './workspace-root';
import { getNxRequirePaths } from './installation-directory';

/**
 * Resolve the workspace's installed `nx` version, or `null` if no installed
 * `nx` can be located. Routed through a cache-shielded, self-reference-free
 * `require.resolve` so the answer always reflects the workspace's
 * `node_modules`/PnP store rather than whichever `nx` package happens to be
 * loaded in the current process. See nrwl/nx#35444.
 */
export function getInstalledNxVersion(): string | null {
  const nxPackageJsonPath = resolvePackageJsonWithoutCachePollution(
    'nx',
    getNxRequirePaths(workspaceRoot)
  );
  if (!nxPackageJsonPath) {
    return null;
  }
  try {
    return readJsonFile<PackageJson>(nxPackageJsonPath).version ?? null;
  } catch {
    return null;
  }
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
