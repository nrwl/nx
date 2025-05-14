import type { NxWorkspaceFilesExternals, WorkspaceContext } from '../native';
import { performance } from 'perf_hooks';
import { workspaceDataDirectoryForWorkspace } from './cache-directory';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';

let workspaceContext: WorkspaceContext | undefined;

export function setupWorkspaceContext(workspaceRoot: string) {
  const { WorkspaceContext } =
    require('../native') as typeof import('../native');
  performance.mark('workspace-context');
  workspaceContext = new WorkspaceContext(
    workspaceRoot,
    workspaceDataDirectoryForWorkspace(workspaceRoot)
  );
  performance.mark('workspace-context:end');
  performance.measure(
    'workspace context init',
    'workspace-context',
    'workspace-context:end'
  );
}

export async function getNxWorkspaceFilesFromContext(
  workspaceRoot: string,
  projectRootMap: Record<string, string>
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.getWorkspaceFiles(projectRootMap);
  }
  return daemonClient.getWorkspaceFiles(projectRootMap);
}

/**
 * Sync method to get files matching globs from workspace context.
 * NOTE: This method will create the workspace context if it doesn't exist.
 * It should only be used within Nx internal in code paths that **must** be sync.
 * If used in an isolated plugin thread this will cause the workspace context
 * to be recreated which is slow.
 */
export function globWithWorkspaceContextSync(
  workspaceRoot: string,
  globs: string[],
  exclude?: string[]
) {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.glob(globs, exclude);
}

export async function globWithWorkspaceContext(
  workspaceRoot: string,
  globs: string[],
  exclude?: string[]
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.glob(globs, exclude);
  } else {
    return daemonClient.glob(globs, exclude);
  }
}

export async function multiGlobWithWorkspaceContext(
  workspaceRoot: string,
  globs: string[],
  exclude?: string[]
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.multiGlob(globs, exclude);
  }
  return daemonClient.multiGlob(globs, exclude);
}

export async function hashWithWorkspaceContext(
  workspaceRoot: string,
  globs: string[],
  exclude?: string[]
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.hashFilesMatchingGlob(globs, exclude);
  }
  return daemonClient.hashGlob(globs, exclude);
}

export async function hashMultiGlobWithWorkspaceContext(
  workspaceRoot: string,
  globGroups: string[][]
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.hashFilesMatchingGlobs(globGroups);
  }
  return daemonClient.hashMultiGlob(globGroups);
}

export async function updateContextWithChangedFiles(
  workspaceRoot: string,
  createdFiles: string[],
  updatedFiles: string[],
  deletedFiles: string[]
) {
  if (!daemonClient.enabled()) {
    updateFilesInContext(
      workspaceRoot,
      [...createdFiles, ...updatedFiles],
      deletedFiles
    );
  } else if (isOnDaemon()) {
    // make sure to only import this when running on the daemon
    const { addUpdatedAndDeletedFiles } = await import(
      '../daemon/server/project-graph-incremental-recomputation'
    );
    // update files for the incremental graph recomputation on the daemon
    addUpdatedAndDeletedFiles(createdFiles, updatedFiles, deletedFiles);
  } else {
    // daemon is enabled but we are not running on it, ask the daemon to update the context
    await daemonClient.updateWorkspaceContext(
      createdFiles,
      updatedFiles,
      deletedFiles
    );
  }
}

export function updateFilesInContext(
  workspaceRoot: string,
  updatedFiles: string[],
  deletedFiles: string[]
) {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext?.incrementalUpdate(updatedFiles, deletedFiles);
}

export async function getAllFileDataInContext(workspaceRoot: string) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.allFileData();
  }
  return daemonClient.getWorkspaceContextFileData();
}

export async function getFilesInDirectoryUsingContext(
  workspaceRoot: string,
  dir: string
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.getFilesInDirectory(dir);
  }
  return daemonClient.getFilesInDirectory(dir);
}

export function updateProjectFiles(
  projectRootMappings: Record<string, string>,
  rustReferences: NxWorkspaceFilesExternals,
  updatedFiles: Record<string, string>,
  deletedFiles: string[]
) {
  return workspaceContext?.updateProjectFiles(
    projectRootMappings,
    rustReferences.projectFiles,
    rustReferences.globalFiles,
    updatedFiles,
    deletedFiles
  );
}

function ensureContextAvailable(workspaceRoot: string) {
  if (!workspaceContext || workspaceContext?.workspaceRoot !== workspaceRoot) {
    setupWorkspaceContext(workspaceRoot);
  }
}

export function resetWorkspaceContext() {
  workspaceContext = undefined;
}
