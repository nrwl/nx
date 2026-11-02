import { realpathSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { isContainedRelativePath } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';

/**
 * Whether `packageJsonPath`, resolved for `packageName` from
 * `getNxRequirePaths(root)`, is the workspace's install rather than the temp nx
 * installation on NODE_PATH. The install may sit in an ancestor's node_modules
 * or link outside the root (pnpm's global virtual store).
 */
export function isWorkspaceInstalledPackage(
  packageName: string,
  packageJsonPath: string,
  root: string
): boolean {
  const resolved = realpathOrSelf(packageJsonPath);
  return (
    isInside(resolved, realpathOrSelf(workspaceRoot)) ||
    nodeModulesLookupEntries(packageName, root).some(
      (entry) => realpathOrNull(join(entry, 'package.json')) === resolved
    )
  );
}

export function shouldSkipTempMigrateCli(): boolean {
  return (
    process.env.NX_USE_LOCAL === 'true' ||
    process.env.NX_MIGRATE_USE_LOCAL !== undefined
  );
}

/**
 * Whether the running nx is the workspace's installation rather than the temp
 * one `nx migrate` runs first. Any nx on the lookup chain counts: the hand-off
 * spawns the root's nearest `node_modules/nx` even when `.nx/installation`
 * holds another copy.
 */
export function isRunningWorkspaceNx(): boolean {
  // The wrapper never starts the temp nx under these variables, and the hand-off
  // sets one for its child, so a misjudged location cannot respawn without end.
  if (shouldSkipTempMigrateCli()) {
    return true;
  }
  const running = realpathOrSelf(__dirname);
  return (
    isInside(running, realpathOrSelf(workspaceRoot)) ||
    nodeModulesLookupEntries('nx', workspaceRoot).some((entry) => {
      const target = realpathOrNull(entry);
      return target !== null && isInside(running, target);
    })
  );
}

// The `<dir>/node_modules/<packageName>` paths Node's lookup from
// `getNxRequirePaths(root)` visits up to the filesystem root, wherever they
// link to.
function nodeModulesLookupEntries(packageName: string, root: string): string[] {
  const entries = new Set<string>();
  for (const start of getNxRequirePaths(root)) {
    for (let dir = resolve(start); ; dir = dirname(dir)) {
      entries.add(join(dir, 'node_modules', packageName));
      if (dir === dirname(dir)) break;
    }
  }
  return [...entries];
}

function isInside(path: string, dir: string): boolean {
  return isContainedRelativePath(relative(dir, path));
}

// NX_WORKSPACE_ROOT_PATH is used verbatim, so the workspace root may not exist.
function realpathOrSelf(path: string): string {
  return realpathOrNull(path) ?? path;
}

function realpathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}
