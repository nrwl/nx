import { unlinkSync } from 'fs';
import { platform, tmpdir } from 'os';
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
export const getFullOsSocketPath = () => {
  const path = resolve(getDaemonSocketDir());

  assertValidSocketPath(path);

  return isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};

export const getForkedProcessOsSocketPath = (id: string) => {
  let path = resolve(join(getSocketDir(), 'fp' + id + '.sock'));

  assertValidSocketPath(path);

  return isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};

export const getPluginOsSocketPath = (id: string) => {
  let path = resolve(join(getSocketDir(true), 'plugin' + id + '.sock'));

  assertValidSocketPath(path);

  return isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};

function assertValidSocketPath(path: string) {
  if (path.length > 95) {
    throw new Error(
      [
        'Attempted to open socket that exceeds the maximum socket length.',
        '',
        `Set NX_SOCKET_DIR to a shorter path (e.g. ${
          isWindows ? '%TMP%/nx-tmp' : '/tmp/nx-tmp'
        }) to avoid this issue.`,
      ].join('\n')
    );
  }
}

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
