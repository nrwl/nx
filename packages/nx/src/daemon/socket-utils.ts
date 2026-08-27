import { unlinkSync } from 'fs';
import type { Socket } from 'net';
import { platform } from 'os';
import {
  getDaemonSocketPath,
  getForkedProcessSocketPath,
  getPluginSocketPath,
} from './tmp-dir';
import { createSerializableError } from '../utils/serializable-error';
import { isV8SerializerEnabled } from './is-v8-serializer-enabled';
import { serialize as v8_serialize } from 'v8';
import { writeMessage } from '../utils/consume-messages-from-socket';

export const isWindows = platform() === 'win32';

/**
 * For IPC with the daemon server we use unix sockets or windows named pipes,
 * depending on the user's operating system.
 *
 * The paths themselves — the directory, the file name, the named-pipe form, and
 * the length budget — are all decided in `native/utils/socket_path.rs`, so that
 * Nx and Nx Console cannot disagree about where a socket lives.
 *
 * See https://nodejs.org/dist/latest-v14.x/docs/api/net.html#net_identifying_paths_for_ipc_connections
 * for a full breakdown of OS differences between Unix domain sockets and named
 * pipes.
 */
export const getFullOsSocketPath = () => getDaemonSocketPath();

export const getForkedProcessOsSocketPath = (id: string) =>
  getForkedProcessSocketPath(id);

export const getPluginOsSocketPath = (id: string) => getPluginSocketPath(id);

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
