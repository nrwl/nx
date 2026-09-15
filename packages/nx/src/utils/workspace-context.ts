import type {
  ChangeBatch,
  NxWorkspaceFilesExternals,
  WatchEvent,
  WorkspaceContext,
  WorkspaceContextOptions,
} from '../native';
import { performance } from 'perf_hooks';
import { workspaceDataDirectoryForWorkspace } from './cache-directory';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';
import { handleImport } from './handle-import';

type ChangeSubscriber = (err: string | null, batch: ChangeBatch | null) => void;
type EventSubscriber = (
  err: string | null,
  events: WatchEvent[] | null
) => void;

let workspaceContext: WorkspaceContext | undefined;
let filesReady: Promise<void> | undefined;
// Survive a reset: the daemon tears its context down and lets the next read
// recreate it, and that context must watch and report like the one before.
let contextOptions: WorkspaceContextOptions | undefined;
let contextRoot: string | undefined;
let contextGeneration = 0;
let changeSubscriber: ChangeSubscriber | undefined;
let eventSubscriber: EventSubscriber | undefined;

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

/**
 * Re-walk the workspace and report what changed against the files the context
 * is holding, adopting the fresh files. For a caller that learned on its own
 * that reported changes were incomplete; the context's own watcher recovers
 * from its dropped events without help.
 *
 * Daemon-only: it mutates the context in place, which is safe only where the
 * context is the single source of truth for watched state.
 */
export function rescanAndDiffInContext(workspaceRoot: string): ChangeBatch {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.rescanAndDiff();
}

/**
 * Hears the batches the context applies from its own watcher. Requires a
 * context set up with `watch: true`. `settleWorkspaceContext` can hand back a
 * change this also delivers, before or after; each batch's `seq` orders them.
 */
export function subscribeToWorkspaceChanges(
  workspaceRoot: string,
  callback: ChangeSubscriber
) {
  changeSubscriber = callback;
  ensureContextAvailable(workspaceRoot);
  attachSubscribers();
}

/**
 * Applies every change the watcher has delivered, waiting out the kernel hop,
 * and hands back every change applied since the previous settle for the caller
 * to route. Empty when the context is not watching.
 */
export function settleWorkspaceContext(workspaceRoot: string): ChangeBatch {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.settle();
}

/**
 * Hears every event the context's watch delivers, including writes under
 * ignored directories and the `rescan` marker. The applied batches are
 * `subscribeToWorkspaceChanges`.
 */
export function subscribeToWatchEvents(
  workspaceRoot: string,
  callback: EventSubscriber
) {
  eventSubscriber = callback;
  ensureContextAvailable(workspaceRoot);
  attachSubscribers();
}

function attachSubscribers() {
  // Deliveries a replaced context had already queued must not reach the
  // subscriber as if they came from the current one.
  const generation = contextGeneration;
  const current = () => generation === contextGeneration;
  if (changeSubscriber) {
    const subscriber = changeSubscriber;
    workspaceContext.onChanges((err, batch) => {
      if (current()) subscriber(err, batch);
    });
  }
  if (eventSubscriber) {
    const subscriber = eventSubscriber;
    workspaceContext.onWatchEvents((err, events) => {
      if (current()) subscriber(err, events);
    });
  }
}

export function stopWatchingWorkspaceContext() {
  changeSubscriber = undefined;
  eventSubscriber = undefined;
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
