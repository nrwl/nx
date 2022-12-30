/**
 * In addition to its native performance, another great advantage of `@parcel/watcher` is that it will
 * automatically take advantage of Facebook's watchman tool (https://facebook.github.io/watchman/) if
 * the user has it installed (but not require it if they don't).
 *
 * See https://github.com/parcel-bundler/watcher for more details.
 */
import { workspaceRoot } from '../../utils/workspace-root';
import type { AsyncSubscription, Event } from '@parcel/watcher';
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { FULL_OS_SOCKET_PATH } from '../socket-utils';
import { handleServerProcessTermination } from './shutdown-utils';
import { Server } from 'net';
import ignore from 'ignore';
import { normalizePath } from '../../utils/path';

const ALWAYS_IGNORE = [
  join(workspaceRoot, 'node_modules'),
  join(workspaceRoot, '.git'),
  FULL_OS_SOCKET_PATH,
];

function getIgnoredGlobs() {
  return [
    ...ALWAYS_IGNORE,
    ...getIgnoredGlobsFromFile(join(workspaceRoot, '.nxignore')),
    ...getIgnoredGlobsFromFile(join(workspaceRoot, '.gitignore')),
  ];
}

function getIgnoredGlobsFromFile(file: string): string[] {
  try {
    return readFileSync(file, 'utf-8')
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => !!i && !i.startsWith('#'))
      .map((i) => (i.startsWith('/') ? join(workspaceRoot, i) : i));
  } catch (e) {
    return [];
  }
}

export type FileWatcherCallback = (
  err: Error | null,
  changeEvents: Event[] | null
) => Promise<void>;

function configureIgnoreObject() {
  const ig = ignore();
  try {
    ig.add(readFileSync(`${workspaceRoot}/.gitignore`, 'utf-8'));
  } catch {}
  try {
    ig.add(readFileSync(`${workspaceRoot}/.nxignore`, 'utf-8'));
  } catch {}
  return ig;
}

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
    {
      ignore: [...ALWAYS_IGNORE],
    }
  );
}

export async function subscribeToWorkspaceChanges(
  server: Server,
  cb: FileWatcherCallback
): Promise<AsyncSubscription> {
  /**
   * The imports and exports of @nrwl/workspace are somewhat messy and far reaching across the repo (and beyond),
   * and so it is much safer for us to lazily load here `@parcel/watcher` so that its inclusion is not inadvertently
   * executed by packages which do not have its necessary native binaries available.
   */
  const watcher = await import('@parcel/watcher');
  const ignoreObj = configureIgnoreObject();

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
          workspaceRelativeEvent.path === '.gitignore' ||
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
    {
      ignore: getIgnoredGlobs(),
    }
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
