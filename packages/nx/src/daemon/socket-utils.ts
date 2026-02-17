import { existsSync, unlinkSync } from 'fs';
import { platform, tmpdir } from 'os';
import { join, resolve } from 'path';
import { getDaemonSocketDir, getSocketDir } from './tmp-dir';
import { createSerializableError } from '../utils/serializable-error';
import { isV8SerializerEnabled } from './is-v8-serializer-enabled';
import { serialize as v8_serialize } from 'v8';

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

/**
 * Safely removes a stale plugin socket file if it exists.
 *
 * Plugin workers create Unix domain socket files (or named pipes on Windows)
 * to communicate with the host process. If a worker crashes without cleaning
 * up its socket file, the next worker assigned the same path would fail with
 * EADDRINUSE when calling server.listen(). This is one root cause of the
 * intermittent "plugin worker was not connected to within N seconds" error,
 * because the worker silently fails to listen and the host never connects.
 *
 * Calling `nx reset` clears these stale files, which is why it temporarily
 * resolves the issue. This function provides a programmatic equivalent.
 *
 * On Windows named pipes (\\.\pipe\...), unlinkSync is a no-op since the OS
 * manages pipe lifecycle. The existsSync guard prevents unnecessary errors.
 */
export function cleanupStaleSocketFile(socketPath: string): void {
  try {
    if (!isWindows && existsSync(socketPath)) {
      unlinkSync(socketPath);
    }
  } catch {
    // Ignore errors — if the file can't be removed, server.listen()
    // will surface the real error (EADDRINUSE, EACCES, etc.)
  }
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

/**
 * Helper to serialize data either using v8 serialization or JSON serialization, based on
 * the user's preference and the success of each method. Should only be used by "client" side
 * connections, daemon or other servers should respond based on the type of serialization used
 * by the client it is communicating with.
 *
 * @param data Data to serialize
 * @param force Forces one serialization method over the other
 * @returns Serialized data as a string
 */
export function serialize(data: any, force?: 'v8' | 'json'): string {
  if (force === 'v8' || isV8SerializerEnabled()) {
    try {
      return v8_serialize(data).toString('binary');
    } catch (e) {
      if (force !== 'v8') {
        console.warn(
          `Data could not be serialized using v8 serialization: ${e}. Falling back to JSON serialization.`
        );
        // Fall back to JSON serialization
        return JSON.stringify(data);
      }
      throw e;
    }
  } else {
    try {
      return JSON.stringify(data);
    } catch (e) {
      if (force !== 'json') {
        // Fall back to v8 serialization
        console.warn(
          `Data could not be serialized using JSON.stringify: ${e}. Falling back to v8 serialization.`
        );
        return v8_serialize(data).toString('binary');
      }
      throw e;
    }
  }
}
