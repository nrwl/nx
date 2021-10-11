import type { ProjectGraph } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { unlinkSync } from 'fs';
import { platform } from 'os';
import { join, resolve } from 'path';

/**
 * For IPC with the daemon server we use unix sockets or windows named pipes, depending on the user's operating system.
 *
 * See https://nodejs.org/dist/latest-v14.x/docs/api/net.html#net_identifying_paths_for_ipc_connections for a full breakdown
 * of OS differences between Unix domain sockets and named pipes.
 *
 * We currently create the socket/pipe based on a path within the current workspace so that we maintain one unique daemon per
 * workspace to ensure that subtle differences between Nx workspaces cannot cause issues.
 */
const workspaceSocketPath = join(appRootPath, './nx-daemon.sock');

export const isWindows = platform() === 'win32';

export const FULL_OS_SOCKET_PATH = isWindows
  ? '\\\\.\\pipe\\nx\\' + resolve(workspaceSocketPath)
  : resolve(workspaceSocketPath);

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

// Interpret a string sent over IPC from the server to the client as a project graph result
export function deserializeResult(
  serializedResult: string
): ProjectGraphServerResult {
  try {
    const result = JSON.parse(serializedResult);
    if (result.error) {
      const err = new Error();
      err.message = result.error.message;
      err.stack = result.error.stack;
      result.error = err;
    }
    return result;
  } catch {
    return {
      error: new Error('Could not deserialized project graph result'),
      projectGraph: null,
    };
  }
}
