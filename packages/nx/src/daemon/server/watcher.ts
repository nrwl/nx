/**
 * In addition to its native performance, another great advantage of `@parcel/watcher` is that it will
 * automatically take advantage of Facebook's watchman tool (https://facebook.github.io/watchman/) if
 * the user has it installed (but not require it if they don't).
 *
 * See https://github.com/parcel-bundler/watcher for more details.
 */
import { workspaceRoot } from '../../utils/workspace-root';
import type { AsyncSubscription, Event } from '@parcel/watcher';
import { dirname, relative } from 'path';
import { FULL_OS_SOCKET_PATH } from '../socket-utils';
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

const ALWAYS_IGNORE = [...getAlwaysIgnore(workspaceRoot), FULL_OS_SOCKET_PATH];

export type FileWatcherCallback = (
  err: Error | string | null,
  changeEvents: Event[] | WatchEvent[] | null
) => Promise<void>;

export async function subscribeToOutputsChanges(
  cb: FileWatcherCallback
): Promise<AsyncSubscription> {
  const watcher = await import('@parcel/watcher');
  return await watcher.subscribe(
    workspaceRoot,
    (err, events) => {
      if (err) {
        return cb(err, null);
      } else {
        const workspaceRelativeEvents: Event[] = [];
        for (const event of events) {
          const workspaceRelativeEvent: Event = {
            type: event.type,
            path: normalizePath(relative(workspaceRoot, event.path)),
          };
          workspaceRelativeEvents.push(workspaceRelativeEvent);
        }
        cb(null, workspaceRelativeEvents);
      }
    },
    watcherOptions([...ALWAYS_IGNORE])
  );
}

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

    events = events.filter((event) => {
      return (
        !event.path.startsWith('.git') && !event.path.includes('node_modules')
      );
    });

    if (events.length !== 0) {
      cb(null, events);
    }
  });
  return watcher;
}

export async function subscribeToWorkspaceChanges(
  server: Server,
  cb: FileWatcherCallback
): Promise<AsyncSubscription> {
  /**
   * The imports and exports of @nx/workspace are somewhat messy and far reaching across the repo (and beyond),
   * and so it is much safer for us to lazily load here `@parcel/watcher` so that its inclusion is not inadvertently
   * executed by packages which do not have its necessary native binaries available.
   */
  const watcher = await import('@parcel/watcher');
  const ignoreObj = getIgnoreObject();

  return await watcher.subscribe(
    workspaceRoot,
    (err, events) => {
      if (err) {
        return cb(err, null);
      }

      let hasIgnoreFileUpdate = false;

      // Most of our utilities (ignore, hashing etc) require unix-style workspace relative paths
      const workspaceRelativeEvents: Event[] = [];
      for (const event of events) {
        const workspaceRelativeEvent: Event = {
          type: event.type,
          path: normalizePath(relative(workspaceRoot, event.path)),
        };
        if (
          workspaceRelativeEvent.path.endsWith('.gitignore') ||
          workspaceRelativeEvent.path === '.nxignore'
        ) {
          hasIgnoreFileUpdate = true;
        }
        workspaceRelativeEvents.push(workspaceRelativeEvent);
      }

      // If the ignore files themselves have changed we need to dynamically update our cached ignoreGlobs
      if (hasIgnoreFileUpdate) {
        handleServerProcessTermination({
          server,
          reason: 'Stopping the daemon the set of ignored files changed.',
        });
      }

      const nonIgnoredEvents = workspaceRelativeEvents
        .filter(({ path }) => !!path)
        .filter(({ path }) => !ignoreObj.ignores(path));

      if (nonIgnoredEvents && nonIgnoredEvents.length > 0) {
        cb(null, nonIgnoredEvents);
      }
    },
    watcherOptions(getIgnoredGlobs(workspaceRoot))
  );
}

// TODO: When we update @parcel/watcher to a version that handles negation globs, then this can be folded into the workspace watcher
export async function subscribeToServerProcessJsonChanges(
  cb: () => void
): Promise<AsyncSubscription> {
  const watcher = await import('@parcel/watcher');

  return await watcher.subscribe(
    dirname(serverProcessJsonPath),
    (err, events) => {
      for (const event of events) {
        if (event.path === serverProcessJsonPath) {
          cb();
        }
      }
    },
    watcherOptions([])
  );
}

/**
 * NOTE: An event type of "create" will also apply to the case where the user has restored
 * an original version of a file after modifying/deleting it by using git, so we adjust
 * our log language accordingly.
 */
export function convertChangeEventsToLogMessage(changeEvents: Event[]): string {
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

function watcherOptions(ignore: string[]) {
  const options: import('@parcel/watcher').Options = {
    ignore,
  };

  if (platform() === 'win32') {
    options.backend = 'windows';
  }

  return options;
}
