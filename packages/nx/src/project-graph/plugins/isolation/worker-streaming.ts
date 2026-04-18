import type { Socket } from 'net';
import {
  PluginWorkerEmitLogNotification,
  PluginWorkerUpdateProgressNotification,
  sendMessageOverSocket,
} from './messaging';

// Plugin workers talk to their host process over a single socket that is
// established when the host connects. Plugin code running anywhere in the
// worker process needs a way to emit log lines / progress updates without
// having that socket threaded through every call frame, so we stash a
// module-level reference here when the host connects.
let hostSocket: Socket | null = null;

export function setPluginWorkerHostSocket(socket: Socket): void {
  hostSocket = socket;
  socket.once('close', () => {
    if (hostSocket === socket) hostSocket = null;
  });
}

/**
 * Emits a log line from the plugin worker up to its host. The host
 * decides where it ends up (direct stdout/stderr when running under the
 * CLI, forwarded to the active daemon client when running under the
 * daemon).
 *
 * No-op when called outside of a plugin worker (i.e. no host connected).
 */
export function emitPluginWorkerLog(
  level: PluginWorkerEmitLogNotification['level'],
  message: string
): void {
  if (!hostSocket) return;
  sendMessageOverSocket(hostSocket, {
    type: 'emitLog',
    level,
    message,
  });
}

/**
 * Emits a progress message from the plugin worker up to its host. The
 * host forwards it to the active daemon client (if running under the
 * daemon) so an in-flight spinner can reflect the update. No-op when
 * called outside of a plugin worker.
 */
export function emitPluginWorkerProgress(message: string): void {
  if (!hostSocket) return;
  sendMessageOverSocket(hostSocket, {
    type: 'updateProgress',
    message,
  } satisfies PluginWorkerUpdateProgressNotification);
}
