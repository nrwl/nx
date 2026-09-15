import { workspaceRoot } from '../../utils/workspace-root';
import { relative } from 'path';
import {
  getWatcherInstance,
  handleServerProcessTermination,
} from './shutdown-utils';
import { Server } from 'net';
import { normalizePath } from '../../utils/path';
import { getDaemonProcessIdSync, serverProcessJsonPath } from '../cache';
import type { ChangeBatch, WatchEvent } from '../../native';
import { openSockets } from './server';
import {
  settleWorkspaceContext,
  setupWorkspaceContext,
  stopWatchingWorkspaceContext,
  subscribeToWatchEvents,
  subscribeToWorkspaceChanges,
} from '../../utils/workspace-context';

export type FileWatcherCallback = (
  err: Error | string | null,
  changeEvents: WatchEvent[] | null
) => Promise<void>;

/**
 * Hears what the workspace context applied from its watcher: hashes for what
 * changed, deletes expanded to files, no-op rewrites already dropped.
 */
export type WorkspaceChangesCallback = (
  err: Error | string | null,
  batch: ChangeBatch | null
) => Promise<void>;

export interface WorkspaceWatch {
  stop(): Promise<void>;
}

// Captured by watchWorkspace so flushPendingWorkspaceChanges can route
// settled batches through the same handling as the subscription.
// Definite-assignment: dispatchWorkspaceChanges only runs after
// watchWorkspace has set both, so reading them as non-nullable is safe.
let activeServer!: Server;
let workspaceChangesCallback!: WorkspaceChangesCallback;

export function changedPaths(batch: ChangeBatch): string[] {
  return [
    ...batch.createdFiles.map(({ file }) => file),
    ...batch.updatedFiles.map(({ file }) => file),
    ...batch.deletedFiles,
  ];
}

export function isEmptyBatch(batch: ChangeBatch): boolean {
  return (
    batch.createdFiles.length === 0 &&
    batch.updatedFiles.length === 0 &&
    batch.deletedFiles.length === 0
  );
}

function dispatchWorkspaceChanges(
  batch: ChangeBatch
): Promise<void> | undefined {
  if (restartDaemonIfIgnoreFilesChanged(changedPaths(batch))) {
    return;
  }
  return workspaceChangesCallback(null, batch);
}

// Mirrors the per-directory ignore files create_filter reads (watch_filterer.rs).
// The sources it honours that cannot trigger a restart from here — because they
// are never watched — only take effect on the next daemon start: .git/info/exclude
// (under the hardcoded-ignored .git), the global core.excludesFile (outside the
// tree), and parent .gitignore files above the workspace root.
const IGNORE_FILE_NAMES = ['.gitignore', '.nxignore'];

/**
 * The native filterer's ignore rules are fixed when the watcher starts, so an
 * ignore-file edit needs a daemon restart to take effect. Exposed so the rescan
 * recovery can restart too: an overflow can drop the ignore-file event that
 * dispatchWorkspaceChanges would have caught, and only the re-walk finds it.
 */
export function restartDaemonIfIgnoreFilesChanged(paths: string[]): boolean {
  for (const path of paths) {
    const basename = path.slice(path.lastIndexOf('/') + 1);
    if (IGNORE_FILE_NAMES.includes(basename)) {
      handleServerProcessTermination({
        server: activeServer,
        reason: 'Stopping the daemon the set of ignored files changed (native)',
        sockets: openSockets,
      });
      return true;
    }
  }
  return false;
}

// The daemon's own process file lives under the hardcoded-ignored
// .nx/workspace-data; admitting it into the event stream is what lets
// watchOutputFiles notice that this process is no longer the current daemon.
const relativeServerProcess = normalizePath(
  relative(workspaceRoot, serverProcessJsonPath)
);

/**
 * Sets up the workspace context with its own watch and subscribes to the
 * batches it applies. The context starts watching before it scans, so no
 * write from here on is invisible to both. The same watch feeds
 * watchOutputFiles, so the daemon runs one.
 */
export async function watchWorkspace(
  server: Server,
  cb: WorkspaceChangesCallback
): Promise<WorkspaceWatch> {
  activeServer = server;
  workspaceChangesCallback = cb;
  setupWorkspaceContext(workspaceRoot, {
    watch: true,
    watchGlobs: [`!${relativeServerProcess}`],
  });
  subscribeToWorkspaceChanges(workspaceRoot, (err, batch) => {
    if (err) {
      return cb(err, null);
    }
    dispatchWorkspaceChanges(batch);
  });

  return {
    async stop() {
      stopWatchingWorkspaceContext();
    },
  };
}

/**
 * Apply everything the workspace watcher has seen and feed it through the
 * normal change-handling pipeline. Call this before serving a cached project
 * graph so we never return data that the watcher has already seen invalidated
 * but hasn't flushed yet.
 */
export async function flushPendingWorkspaceChanges() {
  if (!getWatcherInstance()) return;
  const batch = settleWorkspaceContext(workspaceRoot);
  if (isEmptyBatch(batch)) return;
  await dispatchWorkspaceChanges(batch);
}

/**
 * Hears every event the workspace context's watch delivers, which is gated
 * only by the hardcoded ignores: writes to gitignored outputs and dotenv files
 * reach this, unlike the applied batches. Call after watchWorkspace.
 */
export async function watchOutputFiles(
  server: Server,
  cb: FileWatcherCallback
): Promise<WorkspaceWatch> {
  subscribeToWatchEvents(workspaceRoot, (err, events) => {
    if (err) {
      return cb(err, null);
    }

    for (const event of events) {
      if (
        event.path == relativeServerProcess &&
        getDaemonProcessIdSync() !== process.pid
      ) {
        return handleServerProcessTermination({
          server,
          reason: 'this process is no longer the current daemon (native)',
          sockets: openSockets,
        });
      }
    }

    if (events.length !== 0) {
      cb(null, events);
    }
  });
  return {
    async stop() {
      stopWatchingWorkspaceContext();
    },
  };
}

/**
 * NOTE: A created file may be one the user restored to an earlier version
 * with git after modifying or deleting it, so the log language allows for it.
 */
export function convertChangeBatchToLogMessage(batch: ChangeBatch): string {
  const numCreatedOrRestoredFiles = batch.createdFiles.length;
  const numModifiedFiles = batch.updatedFiles.length;
  const numDeletedFiles = batch.deletedFiles.length;

  // If only a single file was changed, show the information inline
  if (numCreatedOrRestoredFiles + numModifiedFiles + numDeletedFiles === 1) {
    if (numCreatedOrRestoredFiles) {
      return `${batch.createdFiles[0].file} was created or restored`;
    }
    if (numModifiedFiles) {
      return `${batch.updatedFiles[0].file} was modified`;
    }
    return `${batch.deletedFiles[0]} was deleted`;
  }

  return `${numCreatedOrRestoredFiles} file(s) created or restored, ${numModifiedFiles} file(s) modified, ${numDeletedFiles} file(s) deleted`;
}
