import type {
  ChangeBatch,
  NxWorkspaceFilesExternals,
  WorkspaceContext,
  WorkspaceContextOptions,
} from '../native';
import { performance } from 'perf_hooks';
import { workspaceDataDirectoryForWorkspace } from './cache-directory';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';
import { handleImport } from './handle-import';

/** The shapes the native watch calls back with, taken from the binding. A
 * failure arrives as an Error with no batch or events, so both are nullable. */
export type WorkspaceChangesListener = Parameters<
  WorkspaceContext['onChanges']
>[0];
export type WatchEventsListener = Parameters<
  WorkspaceContext['onWatchEvents']
>[0];

let workspaceContext: WorkspaceContext | undefined;
let filesReady: Promise<void> | undefined;
// Survive a reset: the daemon tears its context down and lets the next read
// recreate it, and that context must watch and report like the one before.
let contextOptions: WorkspaceContextOptions | undefined;
let contextRoot: string | undefined;
let contextGeneration = 0;
const changeListeners = new Set<WorkspaceChangesListener>();
const eventListeners = new Set<WatchEventsListener>();

export function setupWorkspaceContext(
  workspaceRoot: string,
  options?: WorkspaceContextOptions
) {
  const { WorkspaceContext } =
    require('../native') as typeof import('../native');
  performance.mark('workspace-context');
  const cacheDir = workspaceDataDirectoryForWorkspace(workspaceRoot);
  // A plugin worker is only asked for files after its host finished walking
  // and wrote the archive, so it loads that rather than walking again.
  workspaceContext = (global as any).NX_PLUGIN_WORKER
    ? WorkspaceContext.fromArchive(workspaceRoot, cacheDir, options)
    : new WorkspaceContext(workspaceRoot, cacheDir, options);
  contextOptions = options;
  contextRoot = workspaceRoot;
  contextGeneration++;
  filesReady = undefined;
  if (options?.watch) {
    attachSubscribers();
  }
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

/**
 * The subset of `paths` the workspace file map holds: what the watch tracks,
 * with the ignore rules applied.
 */
export function trackedFilesInContext(
  workspaceRoot: string,
  paths: string[]
): string[] {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext?.trackedFiles(paths) ?? [];
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

export async function getFileHashesInContext(
  workspaceRoot: string,
  files: string[]
): Promise<Array<string | null | undefined>> {
  if (
    workspaceRoot === '/virtual' ||
    (global as any).NX_PLUGIN_WORKER ||
    isOnDaemon() ||
    !daemonClient.enabled()
  ) {
    await ensureFilesReady(workspaceRoot);
    return workspaceContext.getFileHashes(files);
  }

  const fileHashes = new Map(
    (await daemonClient.getWorkspaceContextFileData()).map(({ file, hash }) => [
      file,
      hash,
    ])
  );
  return files.map((file) => fileHashes.get(file) ?? null);
}

/**
 * Listens for the changes a watching context applies: each change reaches the
 * listeners once, here or in `settleWorkspaceContext`, whichever takes it
 * first. Any number of listeners may listen. Returns a function that stops
 * this one.
 */
export function subscribeToWorkspaceChanges(
  workspaceRoot: string,
  listener: WorkspaceChangesListener
): () => void {
  changeListeners.add(listener);
  ensureContextAvailable(workspaceRoot);
  attachSubscribers();
  return () => changeListeners.delete(listener);
}

/**
 * Applies every change the watcher has delivered, waiting out the kernel hop,
 * and takes every change applied and not yet handed out. Empty when the
 * context is not watching.
 */
export function settleWorkspaceContext(workspaceRoot: string): ChangeBatch {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.settle();
}

/**
 * Takes every change applied and not yet handed out, without waiting for the
 * watcher: for a caller that has just applied changes itself.
 */
export function takeAppliedWorkspaceChanges(
  workspaceRoot: string
): ChangeBatch {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.takeAppliedChanges();
}

export function isWatchingWorkspaceContext(): boolean {
  return !!contextOptions?.watch;
}

/**
 * Listens for every event the context's watch delivers, including writes
 * under ignored directories and the `rescan` marker. Any number of listeners
 * may listen. Returns a function that stops this one.
 */
export function subscribeToWatchEvents(
  workspaceRoot: string,
  listener: WatchEventsListener
): () => void {
  eventListeners.add(listener);
  ensureContextAvailable(workspaceRoot);
  attachSubscribers();
  return () => eventListeners.delete(listener);
}

/** Whether a batch carries no change at all. */
export function isEmptyBatch(batch: ChangeBatch): boolean {
  return (
    batch.createdFiles.length === 0 &&
    batch.updatedFiles.length === 0 &&
    batch.deletedFiles.length === 0
  );
}

/**
 * The native context takes one subscriber per stream; it fans out here. A
 * delivery a replaced context had already queued does not reach listeners as
 * if it came from the current one.
 */
function attachSubscribers() {
  if (!workspaceContext || !contextOptions?.watch) return;
  const generation = contextGeneration;
  const current = () => generation === contextGeneration;
  workspaceContext.onChanges((err, batch) => {
    if (!current() || (!err && (!batch || isEmptyBatch(batch)))) return;
    for (const listener of changeListeners) listener(err, batch);
  });
  workspaceContext.onWatchEvents((err, events) => {
    if (!current()) return;
    for (const listener of eventListeners) listener(err, events);
  });
}

export function stopWatchingWorkspaceContext() {
  changeListeners.clear();
  eventListeners.clear();
  contextOptions = undefined;
  workspaceContext?.stopWatching();
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
 * Re-walks the host's files so the archive its plugin workers load includes
 * writes made since the last walk, such as a migration flushing to disk. The
 * walk is selective and shared through the files lock; one still running is
 * reused rather than repeated.
 */
export function refreshWorkspaceContext(workspaceRoot: string) {
  if (workspaceRoot === '/virtual' || isOnDaemon() || daemonClient.enabled()) {
    return;
  }
  if (workspaceContext?.workspaceRoot !== workspaceRoot) {
    setupWorkspaceContext(workspaceRoot);
    return;
  }
  workspaceContext.refresh();
  filesReady = undefined;
}

function ensureContextAvailable(workspaceRoot: string) {
  if (!workspaceContext || workspaceContext?.workspaceRoot !== workspaceRoot) {
    setupWorkspaceContext(workspaceRoot, contextOptions);
  }
}

export function resetWorkspaceContext() {
  workspaceContext?.stopWatching?.();
  workspaceContext = undefined;
  filesReady = undefined;
  // A watching context is the daemon's only watch; left for the next read to
  // re-create, output and dotenv events in between would be lost.
  if (contextOptions?.watch && contextRoot) {
    setupWorkspaceContext(contextRoot, contextOptions);
  }
}
