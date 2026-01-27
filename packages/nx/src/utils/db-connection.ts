import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { closeDbConnection, connectToNxDb, ExternalObject } from '../native';
import { workspaceDataDirectory } from './cache-directory';
import { version as NX_VERSION } from '../../package.json';
import { output } from './output';

const dbConnectionMap = new Map<string, ExternalObject<any>>();

export function getDbConnection(
  opts: {
    directory?: string;
    dbName?: string;
  } = {}
) {
  // Safeguard: warn when client creates DB connection while daemon delegation is enabled
  if (!isOnDaemon() && daemonClient.enabled()) {
    output.warn({
      title: 'Getting DB connection from client',
      bodyLines: [
        'getDbConnection() called from client. DB operations should be delegated to the daemon.',
        'This should not happen. Please report this as a bug.',
        'Stack trace:',
        new Error().stack,
      ],
    });
  }

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
