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

export function removeDbConnection(
  opts: {
    directory?: string;
    dbName?: string;
  } = {}
): boolean {
  opts.directory ??= workspaceDataDirectory;
  const key = `${opts.directory}:${opts.dbName ?? 'default'}`;

  let connection = dbConnectionMap.get(key);
  if (!connection) {
    return false;
  }

  dbConnectionMap.delete(key);
  closeDbConnection(connection);

  return true;
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
