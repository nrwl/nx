import { unlinkSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';
import { DAEMON_SOCKET_PATH } from './tmp-dir';
import { ProjectGraph } from '../config/project-graph';

export const isWindows = platform() === 'win32';

/**
 * For IPC with the daemon server we use unix sockets or windows named pipes, depending on the user's operating system.
 *
 * See https://nodejs.org/dist/latest-v14.x/docs/api/net.html#net_identifying_paths_for_ipc_connections for a full breakdown
 * of OS differences between Unix domain sockets and named pipes.
 */
export const FULL_OS_SOCKET_PATH = isWindows
  ? '\\\\.\\pipe\\nx\\' + resolve(DAEMON_SOCKET_PATH)
  : resolve(DAEMON_SOCKET_PATH);

export function killSocketOrPath(): void {
  try {
    unlinkSync(FULL_OS_SOCKET_PATH);
  } catch {}
}

export interface ProjectGraphServerResult {
  error: Error | null;
  projectGraph: ProjectGraph | null;
}

// Include the original stack trace within the serialized error so that the client can show it to the user.
function serializeError(error: Error | null): string | null {
  if (!error) {
    return null;
  }
  return JSON.stringify(error, Object.getOwnPropertyNames(error));
}

// Prepare a serialized project graph result for sending over IPC from the server to the client
export function serializeResult(
  error: Error | null,
  serializedProjectGraph: string | null
): string | null {
  // We do not want to repeat work `JSON.stringify`ing an object containing the potentially large project graph so merge as strings
  return `{ "error": ${serializeError(
    error
  )}, "projectGraph": ${serializedProjectGraph} }`;
}
