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
 * @param path path within the e2e directory
 * @returns `'${process.cwd()}/tmp/nx-e2e/proj-backup/<path>'`
 */
export function tmpBackupProjPath(path?: string) {
  return path
    ? `${workspaceRoot}/tmp/nx-e2e/proj-backup/${path}`
    : `${workspaceRoot}/tmp/nx-e2e/proj-backup`;
}
