import { existsSync } from 'fs';
import { join } from 'path';
import { readJsonFile } from '../utils/fileutils';
import type { PackageJson } from '../utils/package-json';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';
import { getNxRequirePaths } from '../utils/installation-directory';

// Resolve the workspace's installed nx via direct filesystem lookup when a
// `node_modules` layout is in use, falling back to `require.resolve` for
// PnP-style layouts where `node_modules` doesn't exist on disk.
//
// Why not just use `require.resolve('nx/package.json', { paths })` directly:
// Node's CJS resolver caches results in a process-wide `Module._pathCache`
// keyed by the expanded `paths` argument, but the resolved value can come
// from package self-reference (which ignores `paths`). When the daemon
// loads another `nx` package in-process — e.g. the temp `nx@latest` install
// used by the AI-agents and console-status checks — that load can populate
// the cache key the daemon later asks for, so the daemon's "what version is
// installed?" check returns the temp path. Walking the filesystem directly
// is immune to that cache pollution; the `require.resolve` fallback is only
// reached on PnP, where the temp's in-process load doesn't share the same
// resolution path anyway.
export function getInstalledNxVersion(): string | null {
  for (const requirePath of getNxRequirePaths(workspaceRoot)) {
    const candidate = join(requirePath, 'node_modules', 'nx', 'package.json');
    if (existsSync(candidate)) {
      try {
        return readJsonFile<PackageJson>(candidate).version ?? null;
      } catch {
        // unreadable; try the next require path
      }
    }
  }

  // Fallback for non-node_modules layouts (e.g. Yarn PnP).
  try {
    const nxPackageJsonPath = require.resolve('nx/package.json', {
      paths: getNxRequirePaths(workspaceRoot),
    });
    return readJsonFile<PackageJson>(nxPackageJsonPath).version ?? null;
  } catch {
    return null;
  }
}

export function isNxVersionMismatch(): boolean {
  return getInstalledNxVersion() !== nxVersion;
}
