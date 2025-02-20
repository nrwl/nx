import { closeDbConnection, connectToNxDb, ExternalObject } from '../native';
import { workspaceDataDirectory } from './cache-directory';
import { version as NX_VERSION } from '../../package.json';

const dbConnectionMap = new Map<string, ExternalObject<any>>();

export function getDbConnection(
  opts: {
    directory?: string;
    dbName?: string;
  } = {}
) {
  opts.directory ??= workspaceDataDirectory;
  const key = `${opts.directory}:${opts.dbName ?? 'default'}`;
  const connection = getEntryOrSet(dbConnectionMap, key, () =>
    connectToNxDb(opts.directory, NX_VERSION, opts.dbName)
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
