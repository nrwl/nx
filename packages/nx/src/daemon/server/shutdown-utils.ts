import { workspaceRoot } from '../../utils/workspace-root';
import type { Server, Socket } from 'net';
import { serverLogger } from './logger';
import { serializeResult } from '../socket-utils';
import type { AsyncSubscription } from '@parcel/watcher';
import { deleteDaemonJsonProcessCache } from '../cache';
import type { Watcher } from '../../native';

export const SERVER_INACTIVITY_TIMEOUT_MS = 10800000 as const; // 10800000 ms = 3 hours

let sourceWatcherSubscription: AsyncSubscription | undefined;
let outputsWatcherSubscription: AsyncSubscription | undefined;

export function getSourceWatcherSubscription() {
  return sourceWatcherSubscription;
}

export function storeSourceWatcherSubscription(s: AsyncSubscription) {
  sourceWatcherSubscription = s;
}

export function getOutputsWatcherSubscription() {
  return outputsWatcherSubscription;
}

export function storeOutputsWatcherSubscription(s: AsyncSubscription) {
  outputsWatcherSubscription = s;
}

let processJsonSubscription: AsyncSubscription | undefined;

export function storeProcessJsonSubscription(s: AsyncSubscription) {
  processJsonSubscription = s;
}

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
}

export async function handleServerProcessTermination({
  server,
  reason,
}: HandleServerProcessTerminationParams) {
  try {
    server.close();
    deleteDaemonJsonProcessCache();
    if (sourceWatcherSubscription) {
      await sourceWatcherSubscription.unsubscribe();
      serverLogger.watcherLog(
        `Unsubscribed from changes within: ${workspaceRoot} (sources)`
      );
    }
    if (outputsWatcherSubscription) {
      await outputsWatcherSubscription.unsubscribe();
      serverLogger.watcherLog(
        `Unsubscribed from changes within: ${workspaceRoot} (outputs)`
      );
    }
    if (processJsonSubscription) {
      await processJsonSubscription.unsubscribe();
      serverLogger.watcherLog(
        `Unsubscribed from changes within: ${workspaceRoot} (server-process.json)`
      );
    }

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
  // print some extra stuff in the error message
  serverLogger.requestLog(
    `Responding to the client with an error.`,
    description,
    error.message
  );
  console.error(error);

  error.message = `${error.message}\n\nBecause of the error the Nx daemon process has exited. The next Nx command is going to restart the daemon process.\nIf the error persists, please run "nx reset".`;

  await respondToClient(socket, serializeResult(error, null), null);
  process.exit(1);
}
