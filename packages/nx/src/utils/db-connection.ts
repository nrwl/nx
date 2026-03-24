import {
  closeDbConnection,
  connectToNxDb,
  ExternalObject,
  getMainWorktreeRoot,
} from '../native';
import { workspaceDataDirectoryForWorkspace } from './cache-directory';
import { workspaceRoot } from './workspace-root';

const dbConnectionMap = new Map<string, ExternalObject<any>>();

/**
 * Shared workspace-data directory, resolved once per process.
 * In a git worktree this points to the main repo's workspace-data dir
 * so all worktrees share the same DB.
 */
let _sharedDir: string | undefined;
function sharedWorkspaceDataDirectory(root: string): string {
  if (_sharedDir) return _sharedDir;
  try {
    const mainRoot = getMainWorktreeRoot(root);
    if (mainRoot) {
      _sharedDir = workspaceDataDirectoryForWorkspace(mainRoot);
      return _sharedDir;
    }
  } catch {
    // Fall back to local workspace data if worktree detection fails
  }
  _sharedDir = workspaceDataDirectoryForWorkspace(root);
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

export function removeDbConnections() {
  for (const connection of dbConnectionMap.values()) {
    closeDbConnection(connection);
  }
  dbConnectionMap.clear();
}

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
