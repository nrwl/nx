import { workspaceRoot } from '../../utils/workspace-root';
import type { Server, Socket } from 'net';
import { serverLogger } from './logger';
import { serializeResult } from '../socket-utils';
import { deleteDaemonJsonProcessCache } from '../cache';
import type { Watcher } from '../../native';
import { cleanupPlugins } from './plugins';
import {
  DaemonProjectGraphError,
  ProjectGraphError,
} from '../../project-graph/error-types';

export const SERVER_INACTIVITY_TIMEOUT_MS = 10800000 as const; // 10800000 ms = 3 hours

let watcherInstance: Watcher | undefined;

export function storeWatcherInstance(instance: Watcher) {
  watcherInstance = instance;
}

export function getWatcherInstance() {
  return watcherInstance;
}

let outputWatcherInstance: Watcher | undefined;

export function storeOutputWatcherInstance(instance: Watcher) {
  outputWatcherInstance = instance;
}

export function getOutputWatcherInstance() {
  return outputWatcherInstance;
}

interface HandleServerProcessTerminationParams {
  server: Server;
  reason: string;
  sockets: Iterable<Socket>;
}

export async function handleServerProcessTermination({
  server,
  reason,
  sockets,
}: HandleServerProcessTerminationParams) {
  try {
    await new Promise((res) => {
      server.close(() => {
        res(null);
      });

      for (const socket of sockets) {
        socket.destroy();
      }
    });

    if (watcherInstance) {
      await watcherInstance.stop();
      serverLogger.watcherLog(
        `Stopping the watcher for ${workspaceRoot} (sources)`
      );
    }

    if (outputWatcherInstance) {
      await outputWatcherInstance.stop();
      serverLogger.watcherLog(
        `Stopping the watcher for ${workspaceRoot} (outputs)`
      );
    }

    deleteDaemonJsonProcessCache();
    cleanupPlugins();

    serverLogger.log(`Server stopped because: "${reason}"`);
  } finally {
    process.exit(0);
  }
}

let serverInactivityTimerId: NodeJS.Timeout | undefined;

export function resetInactivityTimeout(cb: () => void): void {
  if (serverInactivityTimerId) {
    clearTimeout(serverInactivityTimerId);
  }
  serverInactivityTimerId = setTimeout(cb, SERVER_INACTIVITY_TIMEOUT_MS);
}

export function respondToClient(
  socket: Socket,
  response: string,
  description: string
) {
  return new Promise(async (res) => {
    if (description) {
      serverLogger.requestLog(`Responding to the client.`, description);
    }
    socket.write(`${response}${String.fromCodePoint(4)}`, (err) => {
      if (err) {
        console.error(err);
      }
      serverLogger.log(`Done responding to the client`, description);
      res(null);
    });
  });
}

export async function respondWithErrorAndExit(
  socket: Socket,
  description: string,
  error: Error
) {
  const normalizedError =
    error instanceof DaemonProjectGraphError
      ? ProjectGraphError.fromDaemonProjectGraphError(error)
      : error;

  // print some extra stuff in the error message
  serverLogger.requestLog(
    `Responding to the client with an error.`,
    description,
    normalizedError.message
  );
  console.error(normalizedError.stack);

  // Respond with the original error
  await respondToClient(socket, serializeResult(error, null, null), null);
}
