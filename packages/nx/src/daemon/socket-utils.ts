import { unlinkSync } from 'fs';
import type { Socket } from 'net';
import { platform, tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import {
  getDaemonSocketDir,
  getPluginSocketDir,
  getRefusedConfiguredSocketDir,
  getSocketDir,
  getSocketDirFallbackCause,
} from './tmp-dir';
import { createSerializableError } from '../utils/serializable-error';
import { isV8SerializerEnabled } from './is-v8-serializer-enabled';
import { serialize as v8_serialize } from 'v8';
import { writeMessage } from '../utils/consume-messages-from-socket';

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
  let path = resolve(join(getPluginSocketDir(), getPluginSocketFileName(id)));

  assertValidSocketPath(path);

  return isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};

export function getPluginSocketFileName(id: string): string {
  return `p${id}.sock`;
}

function assertValidSocketPath(path: string) {
  if (path.length > 95) {
    const fallbackCause = getSocketDirFallbackCause();
    const refusedConfiguredSocketDir = getRefusedConfiguredSocketDir();
    throw new Error(
      [
        'Attempted to open socket that exceeds the maximum socket length.',
        ...(fallbackCause === undefined
          ? []
          : [
              `Nx fell back to ${dirname(
                path
              )} because the default socket directory could not be used.`,
              'Run the command with --verbose to see why the default directory was rejected.',
            ]),
        '',
        ...(refusedConfiguredSocketDir === undefined
          ? [
              `Set NX_SOCKET_DIR to a shorter path (e.g. ${
                isWindows ? '%TMP%/nx-tmp' : '/tmp/nx-tmp'
              }) to avoid this issue.`,
            ]
          : [
              // Saying "set a shorter path" here would be advice they already
              // followed: they set one, and it was refused for another reason.
              `The directory set in NX_SOCKET_DIR (${refusedConfiguredSocketDir}) could not be used — see the warning above — so Nx fell back to a longer path.`,
              'Point NX_SOCKET_DIR at a short directory your user owns.',
            ]),
      ].join('\n'),
      fallbackCause === undefined ? undefined : { cause: fallbackCause }
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

function serializeAs(data: any, format: 'v8' | 'json'): Buffer {
  return format === 'v8'
    ? v8_serialize(data)
    : Buffer.from(JSON.stringify(data), 'utf8');
}

/**
 * Serialize using `preferred`, falling back to the other format when it throws.
 * Neither format subsumes the other: JSON cannot represent a BigInt and hits the
 * max string length far sooner, while v8 cannot clone a function.
 *
 * @param data Data to serialize
 * @param preferred Format to attempt first
 * @returns Serialized data as bytes ready to be framed onto a socket
 */
export function serializeWithFallback(
  data: any,
  preferred: 'v8' | 'json'
): Buffer {
  try {
    return serializeAs(data, preferred);
  } catch (e) {
    const fallback = preferred === 'v8' ? 'json' : 'v8';
    console.warn(
      `Data could not be serialized using ${preferred} serialization: ${e}. Falling back to ${fallback} serialization.`
    );
    return serializeAs(data, fallback);
  }
}

/**
 * Serialize data for IPC using the format the user configured.
 *
 * @param data Data to serialize
 * @param force Use this format without falling back. For callers whose data is
 *              known to be unrepresentable in the other format, where a fallback
 *              would only swap one failure for a less obvious one.
 * @returns Serialized data as bytes ready to be framed onto a socket
 */
export function serialize(data: any, force?: 'v8' | 'json'): Buffer {
  return force
    ? serializeAs(data, force)
    : serializeWithFallback(data, isV8SerializerEnabled() ? 'v8' : 'json');
}

/**
 * Serialize `data` and write it as one framed message.
 *
 * Lives here rather than in `writeMessage` so the framing stays a byte-level
 * primitive: `utils/consume-messages-from-socket` is shared by callers that
 * already hold bytes, and having it reach back into the daemon's serializer
 * would invert the dependency.
 */
export function sendMessage(
  socket: Socket,
  data: any,
  force?: 'v8' | 'json',
  callback?: (err?: Error) => void
): void {
  writeMessage(socket, serialize(data, force), callback);
}
