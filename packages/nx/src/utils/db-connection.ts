import { closeDbConnection, connectToNxDb, ExternalObject } from '../native';
import {
  sharedDataDirectory,
  workspaceDataDirectoryForWorkspace,
} from './cache-directory';
import { workspaceRoot } from './workspace-root';

const dbConnectionMap = new Map<string, ExternalObject<any>>();

/**
 * Where the shared DB lives, resolved once per process.
 *
 * The DB is the only thing that uses the shared `workspace-data` directory --
 * daemon logs and the `disabled` marker stay in the checkout's own, because
 * they describe that checkout. Sharing is not decided here: this DB indexes the
 * cache directory's contents, so the two have to land in the same scope or a
 * cache hit resolves to artifacts that were never written here.
 */
let _sharedDir: string | undefined;
function sharedWorkspaceDataDirectory(root: string): string {
  _sharedDir ??= sharedDataDirectory(root, 'workspace-data');
  return _sharedDir;
}

export function getDbConnection(
  opts: {
    directory?: string;
    dbName?: string;
  } = {}
) {
  opts.directory ??= sharedWorkspaceDataDirectory(workspaceRoot);
  const key = `${opts.directory}:${opts.dbName ?? 'default'}`;
  const connection = getEntryOrSet(dbConnectionMap, key, () =>
    connectToNxDb(opts.directory, opts.dbName)
  );
  return connection;
}

/**
 * Returns a DB connection scoped to the local worktree (not shared).
 * Use this for data that is inherently local to a worktree, such as
 * running task tracking, where sharing across worktrees would cause
 * false conflicts.
 */
export function getLocalDbConnection(
  opts: {
    dbName?: string;
  } = {}
) {
  const directory = workspaceDataDirectoryForWorkspace(workspaceRoot);
  const key = `${directory}:${opts.dbName ?? 'default'}`;
  const connection = getEntryOrSet(dbConnectionMap, key, () =>
    connectToNxDb(directory, opts.dbName)
  );
  return connection;
}

function removeDbConnections() {
  for (const connection of dbConnectionMap.values()) {
    closeDbConnection(connection);
  }
  dbConnectionMap.clear();
}

process.on('exit', removeDbConnections);

function getEntryOrSet<TKey, TVal>(
  map: Map<TKey, TVal>,
  key: TKey,
  defaultValue: () => TVal
) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const val = defaultValue();
  map.set(key, val);
  return val;
}
