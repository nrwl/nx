import { workspaceRoot } from '@nx/devkit';

export function tmpFolder() {
  return `${workspaceRoot}/tmp`;
}

/**
 * The directory where the e2e workspace resides in.
 *
 * @param path path within the e2e directory
 * @returns `'${process.cwd()}/tmp/nx-e2e/proj/<path>'`
 */
export function tmpProjPath(path?: string) {
  return path
    ? `${tmpFolder()}/nx-e2e/proj/${path}`
    : `${tmpFolder()}/nx-e2e/proj`;
}

/**
 * The workspace backup directory. This is used for caching of the creation of the workspace.
 *
 * @param packageManager package manager used for the workspace
 * @param preset preset used for the workspace
 * @returns `'${process.cwd()}/tmp/nx-e2e/proj-backup/<packageManager>-<preset>'`
 */
export function tmpBackupProjPath(packageManager?: string, preset?: string) {
  const basePath = `${workspaceRoot}/tmp/nx-e2e/proj-backup`;
  if (!packageManager) {
    return basePath;
  }

  const cacheKey = preset ? `${packageManager}-${preset}` : packageManager;
  return `${basePath}/${cacheKey}`;
}
