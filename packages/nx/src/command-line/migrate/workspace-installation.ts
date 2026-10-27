import { realpathSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { isContainedRelativePath } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';

/**
 * Whether `packageJsonPath`, resolved for `packageName` from
 * `getNxRequirePaths(root)`, is the workspace's install rather than the temp nx
 * installation on NODE_PATH. Workspace entries may link outside the root
 * (pnpm's global virtual store).
 */
export function isWorkspaceInstalledPackage(
  packageName: string,
  packageJsonPath: string,
  root: string
): boolean {
  const resolved = realpathOrSelf(packageJsonPath);
  return (
    isInside(resolved, realpathOrSelf(workspaceRoot)) ||
    workspaceNodeModulesEntries(packageName, root).some(
      (entry) => realpathOrNull(join(entry, 'package.json')) === resolved
    )
  );
}

/**
 * Whether the running nx is the workspace's installation rather than the temp
 * one `nx migrate` runs first. Every workspace entry for nx counts, because
 * the hand-off spawns the root `node_modules/nx` even when `.nx/installation`
 * holds another copy.
 */
export function isRunningWorkspaceNx(): boolean {
  const running = realpathOrSelf(__dirname);
  return (
    isInside(running, realpathOrSelf(workspaceRoot)) ||
    workspaceNodeModulesEntries('nx', workspaceRoot).some((entry) => {
      const target = realpathOrNull(entry);
      return target !== null && isInside(running, target);
    })
  );
}

// The `<dir>/node_modules/<packageName>` paths Node's lookup from
// `getNxRequirePaths(root)` visits inside the workspace, wherever they link to.
function workspaceNodeModulesEntries(
  packageName: string,
  root: string
): string[] {
  const workspaceRoots = [
    resolve(workspaceRoot),
    realpathOrSelf(workspaceRoot),
  ];
  const entries = new Set<string>();
  for (const start of getNxRequirePaths(root)) {
    let dir = resolve(start);
    while (workspaceRoots.some((r) => isInside(dir, r))) {
      entries.add(join(dir, 'node_modules', packageName));
      if (dir === dirname(dir)) break;
      dir = dirname(dir);
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
