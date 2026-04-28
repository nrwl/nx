import { readJsonFile } from '../utils/fileutils';
import type { PackageJson } from '../utils/package-json';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';
import { getNxRequirePaths } from '../utils/installation-directory';

// Resolve the workspace's installed nx via Node's CJS resolver, but routed
// through a helper that neutralises the two ways `require.resolve` lies
// about its `paths` argument (see `resolvePackageJsonWithoutCachePollution`
// below). One uniform path that works for `node_modules` and PnP layouts.
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

// Resolve `<packageName>/package.json` via Node's CJS resolver while
// neutralising both ways the resolver can lie about `paths`:
//
//   1. Process-wide `Module._pathCache` — swapped out for the duration of
//      the call, so any cache entries written are discarded and any
//      previously-poisoned entries are not read. Without this, an
//      in-process load of a second `nx` package (e.g. the temp `nx@latest`
//      install used by the daemon's AI-agents and console-status checks)
//      can poison the cache key this call uses and make us read the temp
//      path instead of the workspace path. See nrwl/nx#35444.
//
//   2. Package self-reference — when a file inside package "nx" calls
//      `require.resolve('nx/...')`, Node returns that calling package's
//      own file regardless of the `paths` argument. We avoid that by
//      issuing the resolve from a `createRequire` rooted at a synthetic
//      path that is outside any package, so the resolver has no "self" to
//      reference and must honour `paths`.
function resolvePackageJsonWithoutCachePollution(
  packageName: string,
  requirePaths: string[]
): string | null {
  const Module = require('module');
  const realCache = Module._pathCache;
  Module._pathCache = Object.create(null);
  try {
    const { createRequire } = Module;
    const detachedRequire = createRequire('/__nx_detached_resolver__/x.js');
    return detachedRequire.resolve(`${packageName}/package.json`, {
      paths: requirePaths,
    });
  } catch {
    return null;
  } finally {
    Module._pathCache = realCache;
  }
}

export function isNxVersionMismatch(): boolean {
  return getInstalledNxVersion() !== nxVersion;
}
