import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import type { Server } from 'net';
import { serverLogger } from './logger';
import type { WatcherSubscription } from './watcher';

export const SERVER_INACTIVITY_TIMEOUT_MS = 10800000 as const; // 10800000 ms = 3 hours

type ServerTerminationReason =
  | `received process ${NodeJS.Signals}`
  | '@nrwl/workspace installation changed'
  | `${typeof SERVER_INACTIVITY_TIMEOUT_MS}ms of inactivity`;

interface HandleServerProcessTerminationParams {
  server: Server;
  reason: ServerTerminationReason;
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
        `Unsubscribed from changes within: ${appRootPath}`
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
