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
  getOutputWatcherInstance,
  getSourceWatcherSubscription,
  getWatcherInstance,
  handleServerProcessTermination,
  resetInactivityTimeout,
  respondToClient,
  respondWithErrorAndExit,
  SERVER_INACTIVITY_TIMEOUT_MS,
  storeOutputsWatcherSubscription,
  storeOutputWatcherInstance,
  storeProcessJsonSubscription,
  storeSourceWatcherSubscription,
  storeWatcherInstance,
} from './shutdown-utils';
import {
  convertChangeEventsToLogMessage,
  subscribeToOutputsChanges,
  subscribeToWorkspaceChanges,
  FileWatcherCallback,
  subscribeToServerProcessJsonChanges,
  watchWorkspace,
  watchOutputFiles,
} from './watcher';
import { addUpdatedAndDeletedFiles } from './project-graph-incremental-recomputation';
import { existsSync, statSync } from 'fs';
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
import { handleRequestShutdown } from './handle-request-shutdown';
import {
  registeredFileWatcherSockets,
  removeRegisteredFileWatcherSocket,
} from './file-watching/file-watcher-sockets';
import { nxVersion } from '../../utils/versions';
import { readJsonFile } from '../../utils/fileutils';
import { PackageJson } from '../../utils/package-json';
import { getDaemonProcessIdSync, writeDaemonJsonProcessCache } from '../cache';
import { handleHashTasks } from './handle-hash-tasks';
import { fileHasher, hashArray } from '../../hasher/file-hasher';
import { handleRequestFileData } from './handle-request-file-data';

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

    removeRegisteredFileWatcherSocket(socket);
  });
});
registerProcessTerminationListeners();
registerProcessServerJsonTracking();

async function handleMessage(socket, data: string) {
  if (workspaceWatcherError) {
    await respondWithErrorAndExit(
      socket,
      `File watcher error in the workspace '${workspaceRoot}'.`,
      workspaceWatcherError
    );
  }

  if (daemonIsOutdated()) {
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
    await handleResult(socket, 'PING', () =>
      Promise.resolve({ response: JSON.stringify(true), description: 'ping' })
    );
  } else if (payload.type === 'REQUEST_PROJECT_GRAPH') {
    await handleResult(socket, 'REQUEST_PROJECT_GRAPH', () =>
      handleRequestProjectGraph()
    );
  } else if (payload.type === 'HASH_TASKS') {
    await handleResult(socket, 'HASH_TASKS', () => handleHashTasks(payload));
  } else if (payload.type === 'REQUEST_FILE_DATA') {
    await handleResult(socket, 'REQUEST_FILE_DATA', () =>
      handleRequestFileData()
    );
  } else if (payload.type === 'PROCESS_IN_BACKGROUND') {
    await handleResult(socket, 'PROCESS_IN_BACKGROUND', () =>
      handleProcessInBackground(payload)
    );
  } else if (payload.type === 'RECORD_OUTPUTS_HASH') {
    await handleResult(socket, 'RECORD_OUTPUTS_HASH', () =>
      handleRecordOutputsHash(payload)
    );
  } else if (payload.type === 'OUTPUTS_HASHES_MATCH') {
    await handleResult(socket, 'OUTPUTS_HASHES_MATCH', () =>
      handleOutputsHashesMatch(payload)
    );
  } else if (payload.type === 'REQUEST_SHUTDOWN') {
    await handleResult(socket, 'REQUEST_SHUTDOWN', () =>
      handleRequestShutdown(server, numberOfOpenConnections)
    );
  } else if (payload.type === 'REGISTER_FILE_WATCHER') {
    registeredFileWatcherSockets.push({ socket, config: payload.config });
  } else {
    await respondWithErrorAndExit(
      socket,
      `Invalid payload from the client`,
      new Error(`Unsupported payload sent to daemon server: ${unparsedPayload}`)
    );
  }
}

export async function handleResult(
  socket: Socket,
  type: string,
  hrFn: () => Promise<HandlerResult>
) {
  const startMark = new Date();
  const hr = await hrFn();
  const doneHandlingMark = new Date();
  if (hr.error) {
    await respondWithErrorAndExit(socket, hr.description, hr.error);
  } else {
    await respondToClient(socket, hr.response, hr.description);
  }
  const endMark = new Date();
  serverLogger.log(
    `Handled ${type}. Handling time: ${
      doneHandlingMark.getTime() - startMark.getTime()
    }. Response time: ${endMark.getTime() - doneHandlingMark.getTime()}.`
  );
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

function registerProcessTerminationListeners() {
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
}

async function registerProcessServerJsonTracking() {
  if (useNativeWatcher()) {
    return;
  }

  storeProcessJsonSubscription(
    await subscribeToServerProcessJsonChanges(async () => {
      if (getDaemonProcessIdSync() !== process.pid) {
        await handleServerProcessTermination({
          server,
          reason: 'this process is no longer the current daemon',
        });
      }
    })
  );
}

let existingLockHash: string | undefined;

function daemonIsOutdated(): boolean {
  return nxVersionChanged() || lockFileHashChanged();
}

function nxVersionChanged(): boolean {
  return nxVersion !== getInstalledNxVersion();
}

const nxPackageJsonPath = require.resolve('nx/package.json');

function getInstalledNxVersion() {
  try {
    const { version } = readJsonFile<PackageJson>(nxPackageJsonPath);
    return version;
  } catch (e) {
    // node modules are absent, so we can return null, which would shut down the daemon
    return null;
  }
}

function lockFileHashChanged(): boolean {
  const lockHashes = [
    join(workspaceRoot, 'package-lock.json'),
    join(workspaceRoot, 'yarn.lock'),
    join(workspaceRoot, 'pnpm-lock.yaml'),
  ]
    .filter((file) => existsSync(file))
    .map((file) => fileHasher.hashFile(file));
  const newHash = hashArray(lockHashes);
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

    if (daemonIsOutdated()) {
      await handleServerProcessTermination({
        server,
        reason: 'Lock file changed',
      });
      return;
    }

    if (err || !changeEvents || !changeEvents.length) {
      let error = typeof err === 'string' ? new Error(err) : err;
      serverLogger.watcherLog(
        'Unexpected workspace watcher error',
        error.message
      );
      console.error(error);
      workspaceWatcherError = error;
      return;
    }

    serverLogger.watcherLog(convertChangeEventsToLogMessage(changeEvents));

    const updatedFilesToHash = [];
    const createdFilesToHash = [];
    const deletedFiles = [];

    for (const event of changeEvents) {
      if (event.type === 'delete') {
        deletedFiles.push(event.path);
      } else {
        try {
          const s = statSync(join(workspaceRoot, event.path));
          if (s.isFile()) {
            if (event.type === 'update') {
              updatedFilesToHash.push(event.path);
            } else {
              createdFilesToHash.push(event.path);
            }
          }
        } catch (e) {
          // this can happen when the update file was deleted right after
        }
      }
    }

    addUpdatedAndDeletedFiles(
      createdFilesToHash,
      updatedFilesToHash,
      deletedFiles
    );
  } catch (err) {
    serverLogger.watcherLog(`Unexpected workspace error`, err.message);
    console.error(err);
    workspaceWatcherError = err;
  }
};

const handleOutputsChanges: FileWatcherCallback = async (err, changeEvents) => {
  try {
    if (err || !changeEvents || !changeEvents.length) {
      let error = typeof err === 'string' ? new Error(err) : err;
      serverLogger.watcherLog(
        'Unexpected outputs watcher error',
        error.message
      );
      console.error(error);
      outputsWatcherError = error;
      disableOutputsTracking();
      return;
    }
    if (outputsWatcherError) {
      return;
    }

    serverLogger.watcherLog('Processing file changes in outputs');
    processFileChangesInOutputs(changeEvents);
  } catch (err) {
    serverLogger.watcherLog(`Unexpected outputs watcher error`, err.message);
    console.error(err);
    outputsWatcherError = err;
    disableOutputsTracking();
  }
};

export async function startServer(): Promise<Server> {
  // Persist metadata about the background process so that it can be cleaned up later if needed
  await writeDaemonJsonProcessCache({
    processId: process.pid,
  });

  // See notes in socket-command-line-utils.ts on OS differences regarding clean up of existings connections.
  if (!isWindows) {
    killSocketOrPath();
  }

  return new Promise(async (resolve, reject) => {
    try {
      await fileHasher.ensureInitialized();
      server.listen(FULL_OS_SOCKET_PATH, async () => {
        try {
          serverLogger.log(`Started listening on: ${FULL_OS_SOCKET_PATH}`);
          // this triggers the storage of the lock file hash
          daemonIsOutdated();

          if (useNativeWatcher()) {
            if (!getWatcherInstance()) {
              storeWatcherInstance(
                await watchWorkspace(server, handleWorkspaceChanges)
              );

              serverLogger.watcherLog(
                `Subscribed to changes within: ${workspaceRoot} (native)`
              );
            }

            if (!getOutputWatcherInstance()) {
              storeOutputWatcherInstance(
                await watchOutputFiles(handleOutputsChanges)
              );
            }
          } else {
            if (!getSourceWatcherSubscription()) {
              storeSourceWatcherSubscription(
                await subscribeToWorkspaceChanges(
                  server,
                  handleWorkspaceChanges
                )
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

// TODO(cammisuli): remove with nx 16.6 (only our watcher will be supported)
function useNativeWatcher() {
  return process.env.NX_NATIVE_WATCHER === 'true';
}
