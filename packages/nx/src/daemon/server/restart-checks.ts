import { existsSync } from 'fs';
import type { Server, Socket } from 'net';
import { join, relative } from 'path';
import { hashArray } from '../../hasher/file-hasher';
import type { ChangeBatch, FileData, WatchEvent } from '../../native';
import { hashFile } from '../../native';
import { normalizePath } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import { getDaemonProcessIdSync, serverProcessJsonPath } from '../cache';
import { isNxVersionMismatch } from '../is-nx-version-mismatch';
import { serverLogger } from '../logger';
import {
  handleServerProcessTermination,
  handleServerProcessTerminationWithRestart,
} from './shutdown-utils';

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

// The lockfiles at the workspace root, as the watch reports them. The
// installed packages decide the project graph, so a change to any of them
// restarts the daemon.
const LOCK_FILE_NAMES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
];

let lockFileHash: string | undefined;

function hashLockFiles(): string {
  const lockFiles = LOCK_FILE_NAMES.map((name) => join(workspaceRoot, name));
  return hashArray(lockFiles.filter(existsSync).map(hashFile));
}

/**
 * Records the lockfiles as they are now. Later checks compare against this,
 * so it runs before the watch can report a change to them.
 */
export function recordLockFileHash(): void {
  lockFileHash = hashLockFiles();
}

/**
 * Whether the lockfiles differ from the recorded hash. Records the new hash
 * so the same change is reported once.
 */
export function lockFileHashChanged(): boolean {
  const newHash = hashLockFiles();
  if (lockFileHash && newHash !== lockFileHash) {
    serverLogger.log(
      `[Server] lock file hash changed! old=${lockFileHash}, new=${newHash}`
    );
    lockFileHash = newHash;
    return true;
  }
  lockFileHash = newHash;
  return false;
}

/**
 * Restarts the daemon when a lockfile at the workspace root is among the
 * changed paths and its content differs from what was recorded. Only then
 * are the lockfiles read: the watch names the paths, so an unrelated change
 * costs nothing. True when it restarted the daemon.
 */
export function restartDaemonIfLockFilesChanged(paths: string[]): boolean {
  if (!paths.some((path) => LOCK_FILE_NAMES.includes(path))) {
    return false;
  }
  if (!lockFileHashChanged()) {
    return false;
  }
  restartDaemon('LOCK_FILES_CHANGED');
  return true;
}

/**
 * Stops this daemon when the events show another process has written the
 * daemon's process file, or when the watch dropped events and that write
 * may have been among them. True when it stopped the daemon.
 */
export function stopDaemonIfReplaced(events: WatchEvent[]): boolean {
  const replaced = events.some(
    (event) =>
      (event.path === relativeServerProcess || event.type === 'rescan') &&
      isReplaced()
  );
  if (replaced) {
    stopDaemon('this process is no longer the current daemon (native)');
  }
  return replaced;
}

/**
 * The checks a client connection makes before the daemon serves it: another
 * daemon has taken over, the installed nx is not the one running, or a
 * lockfile changed without the watch reporting it. Each reads one small file,
 * except the lockfile check, which hashes the lockfiles; that cost is paid
 * per connection rather than on a timer. True when it stopped the daemon.
 */
export function stopDaemonIfOutdated(): boolean {
  if (isReplaced()) {
    stopDaemon('this process is no longer the current daemon (native)');
    return true;
  }
  if (isNxVersionMismatch()) {
    serverLogger.log('[Server] Daemon outdated: NX_VERSION_CHANGED');
    stopDaemon('NX_VERSION_CHANGED');
    return true;
  }
  if (lockFileHashChanged()) {
    restartDaemon('LOCK_FILES_CHANGED');
    return true;
  }
  return false;
}

function isReplaced(): boolean {
  return getDaemonProcessIdSync() !== process.pid;
}

function stopDaemon(reason: string) {
  if (!daemon) return;
  handleServerProcessTermination({
    server: daemon.server,
    reason,
    sockets: daemon.sockets,
  });
}

// A lockfile change restarts rather than stops: the clients reconnect to the
// new daemon, which reads the installed packages afresh.
function restartDaemon(reason: string) {
  if (!daemon) return;
  serverLogger.log(`[Server] Daemon outdated: ${reason}`);
  serverLogger.log('[Server] Restarting daemon...');
  handleServerProcessTerminationWithRestart({
    server: daemon.server,
    reason,
    sockets: daemon.sockets,
  });
}
