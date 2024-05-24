import { workspaceRoot } from '../../utils/workspace-root';
import { dirname, relative } from 'path';
import { getFullOsSocketPath } from '../socket-utils';
import { handleServerProcessTermination } from './shutdown-utils';
import { Server } from 'net';
import { normalizePath } from '../../utils/path';
import {
  getAlwaysIgnore,
  getIgnoredGlobs,
  getIgnoreObject,
} from '../../utils/ignore';
import { platform } from 'os';
import { getDaemonProcessIdSync, serverProcessJsonPath } from '../cache';
import type { WatchEvent } from '../../native';

const ALWAYS_IGNORE = [
  ...getAlwaysIgnore(workspaceRoot),
  getFullOsSocketPath(),
];

export type FileWatcherCallback = (
  err: Error | string | null,
  changeEvents: WatchEvent[] | null
) => Promise<void>;

export async function watchWorkspace(server: Server, cb: FileWatcherCallback) {
  const { Watcher } = await import('../../native');

  let relativeServerProcess = normalizePath(
    relative(workspaceRoot, serverProcessJsonPath)
  );

  let watcher = new Watcher(workspaceRoot, [`!${relativeServerProcess}`]);
  watcher.watch((err, events) => {
    if (err) {
      return cb(err, null);
    }

    for (const event of events) {
      if (
        event.path == relativeServerProcess &&
        getDaemonProcessIdSync() !== process.pid
      ) {
        handleServerProcessTermination({
          server,
          reason: 'this process is no longer the current daemon (native)',
        });
      }

      if (event.path.endsWith('.gitignore') || event.path === '.nxignore') {
        // If the ignore files themselves have changed we need to dynamically update our cached ignoreGlobs
        handleServerProcessTermination({
          server,
          reason:
            'Stopping the daemon the set of ignored files changed (native)',
        });
      }
    }

    cb(null, events);
  });

  return watcher;
}

export async function watchOutputFiles(cb: FileWatcherCallback) {
  const { Watcher } = await import('../../native');

  let watcher = new Watcher(workspaceRoot, null, false);
  watcher.watch((err, events) => {
    if (err) {
      return cb(err, null);
    }

    if (events.length !== 0) {
      cb(null, events);
    }
  });
  return watcher;
}

/**
 * NOTE: An event type of "create" will also apply to the case where the user has restored
 * an original version of a file after modifying/deleting it by using git, so we adjust
 * our log language accordingly.
 */
export function convertChangeEventsToLogMessage(
  changeEvents: WatchEvent[]
): string {
  // If only a single file was changed, show the information inline
  if (changeEvents.length === 1) {
    const { path, type } = changeEvents[0];
    let typeLog = 'updated';
    switch (type) {
      case 'create':
        typeLog = 'created or restored';
        break;
      case 'update':
        typeLog = 'modified';
        break;
      case 'delete':
        typeLog = 'deleted';
        break;
    }
    return `${path} was ${typeLog}`;
  }

  let numCreatedOrRestoredFiles = 0;
  let numModifiedFiles = 0;
  let numDeletedFiles = 0;
  for (const event of changeEvents) {
    switch (event.type) {
      case 'create':
        numCreatedOrRestoredFiles++;
        break;
      case 'update':
        numModifiedFiles++;
        break;
      case 'delete':
        numDeletedFiles++;
        break;
    }
  }

  return `${numCreatedOrRestoredFiles} file(s) created or restored, ${numModifiedFiles} file(s) modified, ${numDeletedFiles} file(s) deleted`;
}
