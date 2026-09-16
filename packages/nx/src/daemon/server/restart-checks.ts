import type { Server, Socket } from 'net';
import { relative } from 'path';
import type { ChangeBatch, FileData, WatchEvent } from '../../native';
import { normalizePath } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import { getDaemonProcessIdSync, serverProcessJsonPath } from '../cache';
import { handleServerProcessTermination } from './shutdown-utils';

// Kept apart from server.ts: the recomputation module needs these, and
// importing server.ts starts a server.
let daemon: { server: Server; sockets: Iterable<Socket> } | undefined;

export function registerDaemonForRestartChecks(
  server: Server,
  sockets: Iterable<Socket>
) {
  daemon = { server, sockets };
}

/**
 * The daemon's own process file, workspace-relative. It lives under the
 * hardcoded-ignored .nx/workspace-data, so the watch admits it explicitly;
 * that is how a daemon learns it has been replaced.
 */
export const relativeServerProcess = normalizePath(
  relative(workspaceRoot, serverProcessJsonPath)
);

/** The paths out of a list of files and their hashes. */
export function fileNames(files: FileData[]): string[] {
  return files.map(({ file }) => file);
}

export function changedPaths(batch: ChangeBatch): string[] {
  return [
    ...fileNames(batch.createdFiles),
    ...fileNames(batch.updatedFiles),
    ...batch.deletedFiles,
  ];
}

// Mirrors the per-directory ignore files create_filter reads (watch_filterer.rs).
// The sources it honours that cannot trigger a restart from here — because they
// are never watched — only take effect on the next daemon start: .git/info/exclude
// (under the hardcoded-ignored .git), the global core.excludesFile (outside the
// tree), and parent .gitignore files above the workspace root.
const IGNORE_FILE_NAMES = ['.gitignore', '.nxignore'];

/**
 * The watch's ignore rules are fixed when it starts, so an ignore-file edit
 * needs a daemon restart to take effect. True when it stopped the daemon.
 */
export function restartDaemonIfIgnoreFilesChanged(paths: string[]): boolean {
  for (const path of paths) {
    const basename = path.slice(path.lastIndexOf('/') + 1);
    if (IGNORE_FILE_NAMES.includes(basename)) {
      stopDaemon(
        'Stopping the daemon the set of ignored files changed (native)'
      );
      return true;
    }
  }
  return false;
}

/**
 * Stops this daemon when the events show another process has written the
 * daemon's process file. True when it stopped the daemon.
 */
export function stopDaemonIfReplaced(events: WatchEvent[]): boolean {
  const replaced = events.some(
    (event) =>
      event.path === relativeServerProcess &&
      getDaemonProcessIdSync() !== process.pid
  );
  if (replaced) {
    stopDaemon('this process is no longer the current daemon (native)');
  }
  return replaced;
}

function stopDaemon(reason: string) {
  if (!daemon) return;
  handleServerProcessTermination({
    server: daemon.server,
    reason,
    sockets: daemon.sockets,
  });
}
