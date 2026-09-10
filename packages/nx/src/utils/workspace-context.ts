import type { NxWorkspaceFilesExternals, WorkspaceContext } from '../native';
import { performance } from 'perf_hooks';
import { workspaceDataDirectoryForWorkspace } from './cache-directory';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';
import { handleImport } from './handle-import';

let workspaceContext: WorkspaceContext | undefined;
let filesReady: Promise<void> | undefined;

export function setupWorkspaceContext(workspaceRoot: string) {
  const { WorkspaceContext } =
    require('../native') as typeof import('../native');
  performance.mark('workspace-context');
  const cacheDir = workspaceDataDirectoryForWorkspace(workspaceRoot);
  // A plugin worker is only asked for files after its host finished walking
  // and wrote the archive, so it loads that rather than walking again.
  workspaceContext = (global as any).NX_PLUGIN_WORKER
    ? WorkspaceContext.fromArchive(workspaceRoot, cacheDir)
    : new WorkspaceContext(workspaceRoot, cacheDir);
  filesReady = undefined;
  performance.mark('workspace-context:end');
  performance.measure(
    'workspace context init',
    'workspace-context',
    'workspace-context:end'
  );
}

export async function getNxWorkspaceFilesFromContext(
  workspaceRoot: string,
  projectRootMap: Record<string, string>,
  useDaemonProcess: boolean = true
) {
  if (!useDaemonProcess || isOnDaemon() || !daemonClient.enabled()) {
    await ensureFilesReady(workspaceRoot);
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
  if (workspaceRoot === '/virtual' || isOnDaemon() || !daemonClient.enabled()) {
    await ensureFilesReady(workspaceRoot);
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
  if (workspaceRoot === '/virtual' || isOnDaemon() || !daemonClient.enabled()) {
    await ensureFilesReady(workspaceRoot);
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
    await ensureFilesReady(workspaceRoot);
    return workspaceContext.hashFilesMatchingGlob(globs, exclude);
  }
  return daemonClient.hashGlob(globs, exclude);
}

export async function hashMultiGlobWithWorkspaceContext(
  workspaceRoot: string,
  globGroups: string[][]
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    await ensureFilesReady(workspaceRoot);
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
    const { scheduleProjectGraphRecomputation } = await handleImport(
      '../daemon/server/project-graph-incremental-recomputation.js',
      __dirname
    );
    // update files for the incremental graph recomputation on the daemon
    scheduleProjectGraphRecomputation(createdFiles, updatedFiles, deletedFiles);
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
    await ensureFilesReady(workspaceRoot);
    return workspaceContext.allFileData();
  }
  return daemonClient.getWorkspaceContextFileData();
}

export async function getFilesInDirectoryUsingContext(
  workspaceRoot: string,
  dir: string
) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    await ensureFilesReady(workspaceRoot);
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

/**
 * Waits for the walk behind the context without holding the event loop. The
 * native readers block the calling thread until the files exist, so the async
 * entry points await this first; a plugin host is then never frozen while a
 * worker is connecting to it.
 */
async function ensureFilesReady(workspaceRoot: string) {
  ensureContextAvailable(workspaceRoot);
  // A binding without `ready` (an older native build, a mocked one) reads
  // synchronously as before.
  filesReady ??= workspaceContext.ready?.() ?? Promise.resolve();
  await filesReady;
}

/**
 * Starts the walk without waiting for it. A plugin host calls this before it
 * spawns workers, so the walk overlaps their startup and the readers above
 * find the files ready instead of waiting for them.
 */
export function startWorkspaceContext(workspaceRoot: string) {
  if (
    workspaceRoot === '/virtual' ||
    (!isOnDaemon() && daemonClient.enabled())
  ) {
    return;
  }
  ensureContextAvailable(workspaceRoot);
  filesReady ??= workspaceContext.ready?.() ?? Promise.resolve();
}

function ensureContextAvailable(workspaceRoot: string) {
  if (!workspaceContext || workspaceContext?.workspaceRoot !== workspaceRoot) {
    setupWorkspaceContext(workspaceRoot);
  }
}

export function resetWorkspaceContext() {
  workspaceContext = undefined;
  filesReady = undefined;
}
