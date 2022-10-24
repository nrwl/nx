import { workspaceRoot } from '../../utils/workspace-root';
import { createServer, Server, Socket } from 'net';
import { join } from 'path';
import { PerformanceObserver } from 'perf_hooks';
import {
  FULL_OS_SOCKET_PATH,
  isWindows,
  killSocketOrPath,
} from '../socket-utils';
import { serverLogger } from './logger';
import {
  getOutputsWatcherSubscription,
  getSourceWatcherSubscription,
  handleServerProcessTermination,
  resetInactivityTimeout,
  respondToClient,
  respondWithErrorAndExit,
  SERVER_INACTIVITY_TIMEOUT_MS,
  storeOutputsWatcherSubscription,
  storeSourceWatcherSubscription,
} from './shutdown-utils';
import {
  convertChangeEventsToLogMessage,
  subscribeToOutputsChanges,
  subscribeToWorkspaceChanges,
  FileWatcherCallback,
} from './watcher';
import { addUpdatedAndDeletedFiles } from './project-graph-incremental-recomputation';
import { existsSync, statSync } from 'fs';
import { HashingImpl } from '../../hasher/hashing-impl';
import { defaultFileHasher } from '../../hasher/file-hasher';
import { handleRequestProjectGraph } from './handle-request-project-graph';
import { handleProcessInBackground } from './handle-process-in-background';
import {
  handleOutputsHashesMatch,
  handleRecordOutputsHash,
} from './handle-outputs-tracking';
import { consumeMessagesFromSocket } from '../../utils/consume-messages-from-socket';
import {
  disableOutputsTracking,
  processFileChangesInOutputs,
} from './outputs-tracking';

let performanceObserver: PerformanceObserver | undefined;
let workspaceWatcherError: Error | undefined;
let outputsWatcherError: Error | undefined;

export type HandlerResult = {
  description: string;
  error?: any;
  response?: string;
};

let numberOfOpenConnections = 0;

const server = createServer(async (socket) => {
  numberOfOpenConnections += 1;
  serverLogger.log(
    `Established a connection. Number of open connections: ${numberOfOpenConnections}`
  );
  resetInactivityTimeout(handleInactivityTimeout);
  if (!performanceObserver) {
    performanceObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      serverLogger.log(`Time taken for '${entry.name}'`, `${entry.duration}ms`);
    });
    performanceObserver.observe({ entryTypes: ['measure'] });
  }

  socket.on(
    'data',
    consumeMessagesFromSocket(async (message) => {
      await handleMessage(socket, message);
    })
  );

  socket.on('error', (e) => {
    serverLogger.log('Socket error');
    console.error(e);
  });

  socket.on('close', () => {
    numberOfOpenConnections -= 1;
    serverLogger.log(
      `Closed a connection. Number of open connections: ${numberOfOpenConnections}`
    );
  });
});

async function handleMessage(socket, data: string) {
  if (workspaceWatcherError) {
    await respondWithErrorAndExit(
      socket,
      `File watcher error in the workspace '${workspaceRoot}'.`,
      workspaceWatcherError
    );
  }

  if (lockFileChanged()) {
    await respondWithErrorAndExit(socket, `Lock files changed`, {
      name: '',
      message: 'LOCK-FILES-CHANGED',
    });
  }

  resetInactivityTimeout(handleInactivityTimeout);

  const unparsedPayload = data;
  let payload;
  try {
    payload = JSON.parse(unparsedPayload);
  } catch (e) {
    await respondWithErrorAndExit(
      socket,
      `Invalid payload from the client`,
      new Error(`Unsupported payload sent to daemon server: ${unparsedPayload}`)
    );
  }

  if (payload.type === 'PING') {
    await handleResult(socket, {
      response: JSON.stringify(true),
      description: 'ping',
    });
  } else if (payload.type === 'REQUEST_PROJECT_GRAPH') {
    await handleResult(socket, await handleRequestProjectGraph());
  } else if (payload.type === 'PROCESS_IN_BACKGROUND') {
    await handleResult(socket, await handleProcessInBackground(payload));
  } else if (payload.type === 'RECORD_OUTPUTS_HASH') {
    await handleResult(socket, await handleRecordOutputsHash(payload));
  } else if (payload.type === 'OUTPUTS_HASHES_MATCH') {
    await handleResult(socket, await handleOutputsHashesMatch(payload));
  } else {
    await respondWithErrorAndExit(
      socket,
      `Invalid payload from the client`,
      new Error(`Unsupported payload sent to daemon server: ${unparsedPayload}`)
    );
  }
}

async function handleResult(socket: Socket, hr: HandlerResult) {
  if (hr.error) {
    await respondWithErrorAndExit(socket, hr.description, hr.error);
  } else {
    await respondToClient(socket, hr.response, hr.description);
  }
}

function handleInactivityTimeout() {
  if (numberOfOpenConnections > 0) {
    serverLogger.log(
      `There are ${numberOfOpenConnections} open connections. Reset inactivity timer.`
    );
    resetInactivityTimeout(handleInactivityTimeout);
  } else {
    handleServerProcessTermination({
      server,
      reason: `${SERVER_INACTIVITY_TIMEOUT_MS}ms of inactivity`,
    });
  }
}

process
  .on('SIGINT', () =>
    handleServerProcessTermination({
      server,
      reason: 'received process SIGINT',
    })
  )
  .on('SIGTERM', () =>
    handleServerProcessTermination({
      server,
      reason: 'received process SIGTERM',
    })
  )
  .on('SIGHUP', () =>
    handleServerProcessTermination({
      server,
      reason: 'received process SIGHUP',
    })
  );

let existingLockHash: string | undefined;

function lockFileChanged(): boolean {
  const hash = new HashingImpl();
  const lockHashes = [
    join(workspaceRoot, 'package-lock.json'),
    join(workspaceRoot, 'yarn.lock'),
    join(workspaceRoot, 'pnpm-lock.yaml'),
  ]
    .filter((file) => existsSync(file))
    .map((file) => hash.hashFile(file));
  const newHash = hash.hashArray(lockHashes);
  if (existingLockHash && newHash != existingLockHash) {
    existingLockHash = newHash;
    return true;
  } else {
    existingLockHash = newHash;
    return false;
  }
}

/**
 * When applicable files in the workspaces are changed (created, updated, deleted),
 * we need to recompute the cached serialized project graph so that it is readily
 * available for the next client request to the server.
 */
const handleWorkspaceChanges: FileWatcherCallback = async (
  err,
  changeEvents
) => {
  if (workspaceWatcherError) {
    serverLogger.watcherLog(
      'Skipping handleWorkspaceChanges because of a previously recorded watcher error.'
    );
    return;
  }

  try {
    resetInactivityTimeout(handleInactivityTimeout);

    if (lockFileChanged()) {
      await handleServerProcessTermination({
        server,
        reason: 'Lock file changed',
      });
      return;
    }

    if (err || !changeEvents || !changeEvents.length) {
      serverLogger.watcherLog(
        'Unexpected workspace watcher error',
        err.message
      );
      console.error(err);
      workspaceWatcherError = err;
      return;
    }

    serverLogger.watcherLog(convertChangeEventsToLogMessage(changeEvents));

    const filesToHash = [];
    const deletedFiles = [];
    for (const event of changeEvents) {
      if (event.type === 'delete') {
        deletedFiles.push(event.path);
      } else {
        try {
          const s = statSync(join(workspaceRoot, event.path));
          if (!s.isDirectory()) {
            filesToHash.push(event.path);
          }
        } catch (e) {
          // this can happen when the update file was deleted right after
        }
      }
    }
    addUpdatedAndDeletedFiles(filesToHash, deletedFiles);
  } catch (err) {
    serverLogger.watcherLog(`Unexpected workspace error`, err.message);
    console.error(err);
    workspaceWatcherError = err;
  }
};

const handleOutputsChanges: FileWatcherCallback = async (err, changeEvents) => {
  try {
    if (err || !changeEvents || !changeEvents.length) {
      serverLogger.watcherLog('Unexpected outputs watcher error', err.message);
      console.error(err);
      outputsWatcherError = err;
      disableOutputsTracking();
      return;
    }
    if (outputsWatcherError) {
      return;
    }
    processFileChangesInOutputs(changeEvents);
  } catch (err) {
    serverLogger.watcherLog(`Unexpected outputs watcher error`, err.message);
    console.error(err);
    outputsWatcherError = err;
    disableOutputsTracking();
  }
};

export async function startServer(): Promise<Server> {
  // See notes in socket-command-line-utils.ts on OS differences regarding clean up of existings connections.
  if (!isWindows) {
    killSocketOrPath();
  }
  await defaultFileHasher.ensureInitialized();
  return new Promise((resolve, reject) => {
    try {
      server.listen(FULL_OS_SOCKET_PATH, async () => {
        try {
          serverLogger.log(`Started listening on: ${FULL_OS_SOCKET_PATH}`);
          // this triggers the storage of the lock file hash
          lockFileChanged();

          if (!getSourceWatcherSubscription()) {
            storeSourceWatcherSubscription(
              await subscribeToWorkspaceChanges(server, handleWorkspaceChanges)
            );
            serverLogger.watcherLog(
              `Subscribed to changes within: ${workspaceRoot}`
            );
          }

          // temporary disable outputs tracking on linux
          const outputsTrackingIsEnabled = process.platform != 'linux';
          if (outputsTrackingIsEnabled) {
            if (!getOutputsWatcherSubscription()) {
              storeOutputsWatcherSubscription(
                await subscribeToOutputsChanges(handleOutputsChanges)
              );
            }
          } else {
            disableOutputsTracking();
          }

          return resolve(server);
        } catch (err) {
          await handleWorkspaceChanges(err, []);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        /**
         * If the server is running in a detached background process then server.close()
         * will throw this error even if server is actually alive. We therefore only reject
         * in case of any other unexpected errors.
         */
        if (!err.message.startsWith('Server is not running')) {
          return reject(err);
        }
      }

      killSocketOrPath();
      return resolve();
    });
  });
}
