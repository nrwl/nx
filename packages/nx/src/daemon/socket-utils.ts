import { unlinkSync } from 'fs';
import { platform } from 'os';
import { join, resolve } from 'path';
import { getDaemonSocketDir, getSocketDir } from './tmp-dir';
import { createSerializableError } from '../utils/serializable-error';

export const isWindows = platform() === 'win32';

/**
 * For IPC with the daemon server we use unix sockets or windows named pipes, depending on the user's operating system.
 *
 * See https://nodejs.org/dist/latest-v14.x/docs/api/net.html#net_identifying_paths_for_ipc_connections for a full breakdown
 * of OS differences between Unix domain sockets and named pipes.
 */
export const getFullOsSocketPath = () =>
  isWindows
    ? '\\\\.\\pipe\\nx\\' + resolve(getDaemonSocketDir())
    : resolve(getDaemonSocketDir());

export const getForkedProcessOsSocketPath = (id: string) => {
  let path = resolve(join(getSocketDir(), 'fp' + id + '.sock'));
  return isWindows ? '\\\\.\\pipe\\nx\\' + resolve(path) : resolve(path);
};

export const getPluginOsSocketPath = (id: string) => {
  let path = resolve(join(getSocketDir(), 'plugin' + id + '.sock'));
  return isWindows ? '\\\\.\\pipe\\nx\\' + resolve(path) : resolve(path);
};

export function killSocketOrPath(): void {
  try {
    unlinkSync(getFullOsSocketPath());
  } catch {}
}

// Prepare a serialized project graph result for sending over IPC from the server to the client
export function serializeResult(
  error: Error | null,
  serializedProjectGraph: string | null,
  serializedSourceMaps: string | null
): string | null {
  // We do not want to repeat work `JSON.stringify`ing an object containing the potentially large project graph so merge as strings
  return `{ "error": ${JSON.stringify(
    error ? createSerializableError(error) : error
  )}, "projectGraph": ${serializedProjectGraph}, "sourceMaps": ${serializedSourceMaps} }`;
}
