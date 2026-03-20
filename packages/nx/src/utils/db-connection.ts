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
 * Returns a shared workspace-data directory that is the same across worktrees.
 * If the current workspace is a git worktree, it resolves the main repo's
 * workspace-data dir so all worktrees share the same DB.
 */
function sharedWorkspaceDataDirectory(root: string): string {
  try {
    const mainRoot = getMainWorktreeRoot(root);
    if (mainRoot) {
      return workspaceDataDirectoryForWorkspace(mainRoot);
    }
  } catch {
    // Fall back to local workspace data if worktree detection fails
  }
  return workspaceDataDirectoryForWorkspace(root);
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
