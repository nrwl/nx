import { workspaceRoot } from '../../utils/workspace-root';
import type { Server, Socket } from 'net';
import { serverLogger } from './logger';
import type { WatcherSubscription } from './watcher';
import { serializeResult } from 'nx/src/daemon/socket-utils';

export const SERVER_INACTIVITY_TIMEOUT_MS = 10800000 as const; // 10800000 ms = 3 hours

interface HandleServerProcessTerminationParams {
  server: Server;
  reason: string;
  watcherSubscription: WatcherSubscription | undefined;
}

export async function handleServerProcessTermination({
  server,
  reason,
  watcherSubscription,
}: HandleServerProcessTerminationParams) {
  try {
    server.close();
    if (watcherSubscription) {
      await watcherSubscription.unsubscribe();
      serverLogger.watcherLog(
        `Unsubscribed from changes within: ${workspaceRoot}`
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
  return new Promise((res) => {
    socket.write(response, () => {
      if (description) {
        serverLogger.requestLog(`Responding to the client.`, description);
      }
      // Close the connection once all data has been written so that the client knows when to read it.
      socket.end();
      serverLogger.log(`Closed Connection to Client`);
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
