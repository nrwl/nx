import { existsSync, statSync } from 'fs';
import { createServer, Server, Socket } from 'net';
import { join } from 'path';
import { PerformanceObserver } from 'perf_hooks';
import { hashArray } from '../../hasher/file-hasher';
import { hashFile } from '../../native';
import {
  consumeMessagesFromSocket,
  isJsonMessage,
} from '../../utils/consume-messages-from-socket';
import { nxVersion } from '../../utils/versions';
import { setupWorkspaceContext } from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';
import { getDaemonProcessIdSync, writeDaemonJsonProcessCache } from '../cache';
import {
  getInstalledNxVersion,
  isNxVersionMismatch,
} from '../is-nx-version-mismatch';
import {
  getFullOsSocketPath,
  isWindows,
  killSocketOrPath,
  serializeResult,
} from '../socket-utils';
import {
  hasRegisteredFileWatcherSockets,
  registeredFileWatcherSockets,
  removeRegisteredFileWatcherSocket,
} from './file-watching/file-watcher-sockets';
import {
  hasRegisteredProjectGraphListenerSockets,
  registeredProjectGraphListenerSockets,
  removeRegisteredProjectGraphListenerSocket,
} from './project-graph-listener-sockets';
import { handleHashTasks } from './handle-hash-tasks';
import {
  handleOutputsHashesMatch,
  handleRecordOutputsHash,
} from './handle-outputs-tracking';
import { handleProcessInBackground } from './handle-process-in-background';
import { handleRequestProjectGraph } from './handle-request-project-graph';
import { handleRequestShutdown } from './handle-request-shutdown';
import { serverLogger } from '../logger';
import {
  disableOutputsTracking,
  processFileChangesInOutputs,
} from './outputs-tracking';
import {
  addUpdatedAndDeletedFiles,
  registerProjectGraphRecomputationListener,
} from './project-graph-incremental-recomputation';
import {
  getOutputWatcherInstance,
  getWatcherInstance,
  handleServerProcessTermination,
  handleServerProcessTerminationWithRestart,
  resetInactivityTimeout,
  respondToClient,
  respondWithErrorAndExit,
  SERVER_INACTIVITY_TIMEOUT_MS,
  storeOutputWatcherInstance,
  storeWatcherInstance,
} from './shutdown-utils';
import {
  convertChangeEventsToLogMessage,
  FileWatcherCallback,
  watchOutputFiles,
  watchWorkspace,
} from './watcher';
import { handleGlob, handleMultiGlob } from './handle-glob';
import {
  GLOB,
  isHandleGlobMessage,
  isHandleMultiGlobMessage,
  MULTI_GLOB,
} from '../message-types/glob';
import {
  GET_NX_WORKSPACE_FILES,
  isHandleNxWorkspaceFilesMessage,
} from '../message-types/get-nx-workspace-files';
import { handleNxWorkspaceFiles } from './handle-nx-workspace-files';
import {
  GET_CONTEXT_FILE_DATA,
  isHandleContextFileDataMessage,
} from '../message-types/get-context-file-data';
import { handleContextFileData } from './handle-context-file-data';
import {
  GET_FILES_IN_DIRECTORY,
  isHandleGetFilesInDirectoryMessage,
} from '../message-types/get-files-in-directory';
import { handleGetFilesInDirectory } from './handle-get-files-in-directory';
import {
  HASH_GLOB,
  isHandleHashGlobMessage,
  isHandleHashMultiGlobMessage,
} from '../message-types/hash-glob';
import { handleHashGlob, handleHashMultiGlob } from './handle-hash-glob';
import {
  GET_ESTIMATED_TASK_TIMINGS,
  GET_FLAKY_TASKS,
  isHandleGetEstimatedTaskTimings,
  isHandleGetFlakyTasksMessage,
  isHandleWriteTaskRunsToHistoryMessage,
  RECORD_TASK_RUNS,
} from '../message-types/task-history';
import {
  handleRecordTaskRuns,
  handleGetFlakyTasks,
  handleGetEstimatedTaskTimings,
} from './handle-task-history';
import {
  RECORD_TASK_DETAILS,
  isHandleRecordTaskDetailsMessage,
} from '../message-types/task-details';
import { handleRecordTaskDetails } from './handle-task-details';
import {
  GET_RUNNING_TASKS,
  ADD_RUNNING_TASK,
  REMOVE_RUNNING_TASK,
  isHandleGetRunningTasksMessage,
  isHandleAddRunningTaskMessage,
  isHandleRemoveRunningTaskMessage,
} from '../message-types/running-tasks';
import {
  handleGetRunningTasks,
  handleAddRunningTask,
  handleRemoveRunningTask,
} from './handle-running-tasks';
import {
  CACHE_GET,
  CACHE_PUT,
  CACHE_REMOVE_OLD_RECORDS,
  CACHE_APPLY_REMOTE_RESULTS,
  CACHE_GET_SIZE,
  CACHE_CHECK_FS_IN_SYNC,
  isHandleCacheGetMessage,
  isHandleCachePutMessage,
  isHandleCacheRemoveOldRecordsMessage,
  isHandleCacheApplyRemoteResultsMessage,
  isHandleCacheGetSizeMessage,
  isHandleCacheCheckFsInSyncMessage,
} from '../message-types/cache';
import {
  handleCacheGet,
  handleCachePut,
  handleCacheRemoveOldRecords,
  handleCacheApplyRemoteResults,
  handleCacheGetSize,
  handleCacheCheckFsInSync,
} from './handle-cache';
import { isHandleForceShutdownMessage } from '../message-types/force-shutdown';
import { handleForceShutdown } from './handle-force-shutdown';
import {
  GET_SYNC_GENERATOR_CHANGES,
  isHandleGetSyncGeneratorChangesMessage,
} from '../message-types/get-sync-generator-changes';
import { handleGetSyncGeneratorChanges } from './handle-get-sync-generator-changes';
import {
  clearSyncGeneratorsCache,
  collectAndScheduleSyncGenerators,
} from './sync-generators';
import { registerFileChangeListener } from './file-watching/file-change-events';
import {
  GET_REGISTERED_SYNC_GENERATORS,
  isHandleGetRegisteredSyncGeneratorsMessage,
} from '../message-types/get-registered-sync-generators';
import { handleGetRegisteredSyncGenerators } from './handle-get-registered-sync-generators';
import {
  UPDATE_WORKSPACE_CONTEXT,
  isHandleUpdateWorkspaceContextMessage,
} from '../message-types/update-workspace-context';
import { handleUpdateWorkspaceContext } from './handle-update-workspace-context';
import {
  FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
  isHandleFlushSyncGeneratorChangesToDiskMessage,
} from '../message-types/flush-sync-generator-changes-to-disk';
import { handleFlushSyncGeneratorChangesToDisk } from './handle-flush-sync-generator-changes-to-disk';
import {
  isHandlePostTasksExecutionMessage,
  isHandlePreTasksExecutionMessage,
  POST_TASKS_EXECUTION,
  PRE_TASKS_EXECUTION,
} from '../message-types/run-tasks-execution-hooks';
import {
  handleRunPostTasksExecution,
  handleRunPreTasksExecution,
} from './handle-tasks-execution-hooks';
import {
  isRegisterProjectGraphListenerMessage,
  REGISTER_PROJECT_GRAPH_LISTENER,
} from '../message-types/register-project-graph-listener';
import {
  GET_NX_CONSOLE_STATUS,
  isHandleGetNxConsoleStatusMessage,
  isHandleSetNxConsolePreferenceAndInstallMessage,
  SET_NX_CONSOLE_PREFERENCE_AND_INSTALL,
} from '../message-types/nx-console';
import {
  handleGetNxConsoleStatus,
  handleSetNxConsolePreferenceAndInstall,
} from './handle-nx-console';
import { deserialize, serialize } from 'v8';

let performanceObserver: PerformanceObserver | undefined;
let workspaceWatcherError: Error | undefined;
let outputsWatcherError: Error | undefined;

global.NX_DAEMON = true;

export type HandlerResult = {
  description: string;
  error?: any;
  response?: string | object | boolean | number;
};

let numberOfOpenConnections = 0;
export const openSockets: Set<Socket> = new Set();

const server = createServer(async (socket) => {
  numberOfOpenConnections += 1;
  openSockets.add(socket);
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
    openSockets.delete(socket);
    serverLogger.log(
      `Closed a connection. Number of open connections: ${numberOfOpenConnections}`
    );

    removeRegisteredFileWatcherSocket(socket);
    removeRegisteredProjectGraphListenerSocket(socket);
  });
});
registerProcessTerminationListeners();

async function handleMessage(socket: Socket, data: string) {
  if (workspaceWatcherError) {
    await respondWithErrorAndExit(
      socket,
      `File watcher error in the workspace '${workspaceRoot}'.`,
      workspaceWatcherError
    );
  }

  resetInactivityTimeout(handleInactivityTimeout);

  const unparsedPayload = data;
  let payload;
  let mode: 'json' | 'v8' = 'json';

  serverLogger.log(`Received raw message of length ${unparsedPayload.length}`);

  try {
    // JSON Message
    if (isJsonMessage(unparsedPayload)) {
      payload = JSON.parse(unparsedPayload);
    } else {
      // V8 Serialized Message
      payload = deserialize(Buffer.from(unparsedPayload, 'binary'));
      mode = 'v8';
    }
  } catch (e) {
    await respondWithErrorAndExit(
      socket,
      `Invalid payload from the client`,
      new Error(`Unsupported payload sent to daemon server: ${unparsedPayload}`)
    );
  }
  serverLogger.log(`Received ${mode} message of type ${payload.type}`);

  if (payload.type === 'PING') {
    await handleResult(
      socket,
      'PING',
      () => Promise.resolve({ response: true, description: 'ping' }),
      mode
    );
  } else if (payload.type === 'REQUEST_PROJECT_GRAPH') {
    await handleResult(
      socket,
      'REQUEST_PROJECT_GRAPH',
      () => handleRequestProjectGraph(),
      mode
    );
  } else if (payload.type === 'HASH_TASKS') {
    await handleResult(
      socket,
      'HASH_TASKS',
      () => handleHashTasks(payload),
      mode
    );
  } else if (payload.type === 'PROCESS_IN_BACKGROUND') {
    await handleResult(
      socket,
      'PROCESS_IN_BACKGROUND',
      () => handleProcessInBackground(payload),
      mode
    );
  } else if (payload.type === 'RECORD_OUTPUTS_HASH') {
    await handleResult(
      socket,
      'RECORD_OUTPUTS_HASH',
      () => handleRecordOutputsHash(payload),
      mode
    );
  } else if (payload.type === 'OUTPUTS_HASHES_MATCH') {
    await handleResult(
      socket,
      'OUTPUTS_HASHES_MATCH',
      () => handleOutputsHashesMatch(payload),
      mode
    );
  } else if (payload.type === 'REQUEST_SHUTDOWN') {
    await handleResult(
      socket,
      'REQUEST_SHUTDOWN',
      () => handleRequestShutdown(server, numberOfOpenConnections),
      mode
    );
  } else if (payload.type === 'REGISTER_FILE_WATCHER') {
    registeredFileWatcherSockets.push({ socket, config: payload.config });
  } else if (isRegisterProjectGraphListenerMessage(payload)) {
    registeredProjectGraphListenerSockets.push(socket);
  } else if (isHandleGlobMessage(payload)) {
    await handleResult(
      socket,
      GLOB,
      () => handleGlob(payload.globs, payload.exclude),
      mode
    );
  } else if (isHandleMultiGlobMessage(payload)) {
    await handleResult(
      socket,
      MULTI_GLOB,
      () => handleMultiGlob(payload.globs, payload.exclude),
      mode
    );
  } else if (isHandleNxWorkspaceFilesMessage(payload)) {
    await handleResult(
      socket,
      GET_NX_WORKSPACE_FILES,
      () => handleNxWorkspaceFiles(payload.projectRootMap),
      mode
    );
  } else if (isHandleGetFilesInDirectoryMessage(payload)) {
    await handleResult(
      socket,
      GET_FILES_IN_DIRECTORY,
      () => handleGetFilesInDirectory(payload.dir),
      mode
    );
  } else if (isHandleContextFileDataMessage(payload)) {
    await handleResult(
      socket,
      GET_CONTEXT_FILE_DATA,
      () => handleContextFileData(),
      mode
    );
  } else if (isHandleHashGlobMessage(payload)) {
    await handleResult(
      socket,
      HASH_GLOB,
      () => handleHashGlob(payload.globs, payload.exclude),
      mode
    );
  } else if (isHandleHashMultiGlobMessage(payload)) {
    await handleResult(
      socket,
      HASH_GLOB,
      () => handleHashMultiGlob(payload.globGroups),
      mode
    );
  } else if (isHandleGetFlakyTasksMessage(payload)) {
    await handleResult(
      socket,
      GET_FLAKY_TASKS,
      () => handleGetFlakyTasks(payload.hashes),
      mode
    );
  } else if (isHandleGetEstimatedTaskTimings(payload)) {
    await handleResult(
      socket,
      GET_ESTIMATED_TASK_TIMINGS,
      () => handleGetEstimatedTaskTimings(payload.targets),
      mode
    );
  } else if (isHandleWriteTaskRunsToHistoryMessage(payload)) {
    await handleResult(
      socket,
      RECORD_TASK_RUNS,
      () => handleRecordTaskRuns(payload.taskRuns),
      mode
    );
  } else if (isHandleRecordTaskDetailsMessage(payload)) {
    await handleResult(
      socket,
      RECORD_TASK_DETAILS,
      () => handleRecordTaskDetails(payload.taskDetails),
      mode
    );
  } else if (isHandleGetRunningTasksMessage(payload)) {
    await handleResult(
      socket,
      GET_RUNNING_TASKS,
      () => handleGetRunningTasks(payload.ids),
      mode
    );
  } else if (isHandleAddRunningTaskMessage(payload)) {
    await handleResult(
      socket,
      ADD_RUNNING_TASK,
      () => handleAddRunningTask(payload.taskId),
      mode
    );
  } else if (isHandleRemoveRunningTaskMessage(payload)) {
    await handleResult(
      socket,
      REMOVE_RUNNING_TASK,
      () => handleRemoveRunningTask(payload.taskId),
      mode
    );
  } else if (isHandleForceShutdownMessage(payload)) {
    await handleResult(
      socket,
      'FORCE_SHUTDOWN',
      () => handleForceShutdown(server),
      mode
    );
  } else if (isHandleGetSyncGeneratorChangesMessage(payload)) {
    await handleResult(
      socket,
      GET_SYNC_GENERATOR_CHANGES,
      () => handleGetSyncGeneratorChanges(payload.generators),
      mode
    );
  } else if (isHandleFlushSyncGeneratorChangesToDiskMessage(payload)) {
    await handleResult(
      socket,
      FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
      () => handleFlushSyncGeneratorChangesToDisk(payload.generators),
      mode
    );
  } else if (isHandleGetRegisteredSyncGeneratorsMessage(payload)) {
    await handleResult(
      socket,
      GET_REGISTERED_SYNC_GENERATORS,
      () => handleGetRegisteredSyncGenerators(),
      mode
    );
  } else if (isHandleUpdateWorkspaceContextMessage(payload)) {
    await handleResult(
      socket,
      UPDATE_WORKSPACE_CONTEXT,
      () =>
        handleUpdateWorkspaceContext(
          payload.createdFiles,
          payload.updatedFiles,
          payload.deletedFiles
        ),
      mode
    );
  } else if (isHandlePreTasksExecutionMessage(payload)) {
    await handleResult(
      socket,
      PRE_TASKS_EXECUTION,
      () => handleRunPreTasksExecution(payload.context),
      mode
    );
  } else if (isHandlePostTasksExecutionMessage(payload)) {
    await handleResult(
      socket,
      POST_TASKS_EXECUTION,
      () => handleRunPostTasksExecution(payload.context),
      mode
    );
  } else if (isHandleGetNxConsoleStatusMessage(payload)) {
    await handleResult(
      socket,
      GET_NX_CONSOLE_STATUS,
      () => handleGetNxConsoleStatus(),
      mode
    );
  } else if (isHandleSetNxConsolePreferenceAndInstallMessage(payload)) {
    await handleResult(
      socket,
      SET_NX_CONSOLE_PREFERENCE_AND_INSTALL,
      () => handleSetNxConsolePreferenceAndInstall(payload.preference),
      mode
    );
  } else if (isHandleCacheGetMessage(payload)) {
    await handleResult(
      socket,
      CACHE_GET,
      () => handleCacheGet(payload.hash),
      mode
    );
  } else if (isHandleCachePutMessage(payload)) {
    await handleResult(
      socket,
      CACHE_PUT,
      () =>
        handleCachePut(
          payload.hash,
          payload.terminalOutput,
          payload.outputs,
          payload.code
        ),
      mode
    );
  } else if (isHandleCacheRemoveOldRecordsMessage(payload)) {
    await handleResult(
      socket,
      CACHE_REMOVE_OLD_RECORDS,
      () => handleCacheRemoveOldRecords(),
      mode
    );
  } else if (isHandleCacheApplyRemoteResultsMessage(payload)) {
    await handleResult(
      socket,
      CACHE_APPLY_REMOTE_RESULTS,
      () =>
        handleCacheApplyRemoteResults(
          payload.hash,
          payload.result,
          payload.outputs
        ),
      mode
    );
  } else if (isHandleCacheGetSizeMessage(payload)) {
    await handleResult(
      socket,
      CACHE_GET_SIZE,
      () => handleCacheGetSize(),
      mode
    );
  } else if (isHandleCacheCheckFsInSyncMessage(payload)) {
    await handleResult(
      socket,
      CACHE_CHECK_FS_IN_SYNC,
      () => handleCacheCheckFsInSync(),
      mode
    );
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
  hrFn: () => Promise<HandlerResult>,
  mode: 'json' | 'v8'
) {
  let hr: HandlerResult;
  const startMark = new Date();
  try {
    hr = await hrFn();
  } catch (error) {
    hr = { description: `[${type}]`, error };
  }
  const doneHandlingMark = new Date();
  if (hr.error) {
    await respondWithErrorAndExit(socket, hr.description, hr.error);
  } else {
    serverLogger.log(
      `Serializing response for ${type} message in ${mode} mode`
    );
    const response =
      typeof hr.response === 'string'
        ? hr.response
        : serializeUnserializedResult(hr.response, mode);
    serverLogger.log(`Responding to ${type} message`);
    await respondToClient(socket, response, hr.description);
  }
  const endMark = new Date();
  serverLogger.log(
    `Handled ${mode} message ${type}. Handling time: ${
      doneHandlingMark.getTime() - startMark.getTime()
    }. Response time: ${endMark.getTime() - doneHandlingMark.getTime()}.`
  );
}

function handleInactivityTimeout() {
  if (
    hasRegisteredFileWatcherSockets() ||
    hasRegisteredProjectGraphListenerSockets()
  ) {
    serverLogger.log(
      `There are open file watchers or project graph listeners. Resetting inactivity timer.`
    );
    resetInactivityTimeout(handleInactivityTimeout);
  } else {
    handleServerProcessTermination({
      server,
      reason: `${SERVER_INACTIVITY_TIMEOUT_MS}ms of inactivity`,
      sockets: openSockets,
    });
  }
}

function registerProcessTerminationListeners() {
  process
    .on('SIGINT', () =>
      handleServerProcessTermination({
        server,
        reason: 'received process SIGINT',
        sockets: openSockets,
      })
    )
    .on('SIGTERM', () =>
      handleServerProcessTermination({
        server,
        reason: 'received process SIGTERM',
        sockets: openSockets,
      })
    )
    .on('SIGHUP', () =>
      handleServerProcessTermination({
        server,
        reason: 'received process SIGHUP',
        sockets: openSockets,
      })
    );
}

let existingLockHash: string | undefined;

function daemonIsOutdated(): string | null {
  if (isNxVersionMismatch()) {
    return 'NX_VERSION_CHANGED';
  } else if (lockFileHashChanged()) {
    return 'LOCK_FILES_CHANGED';
  }
  return null;
}

function lockFileHashChanged(): boolean {
  const lockFiles = [
    join(workspaceRoot, 'package-lock.json'),
    join(workspaceRoot, 'yarn.lock'),
    join(workspaceRoot, 'pnpm-lock.yaml'),
    join(workspaceRoot, 'bun.lockb'),
    join(workspaceRoot, 'bun.lock'),
  ];

  const existingFiles = lockFiles.filter((file) => existsSync(file));
  const lockHashes = existingFiles.map((file) => hashFile(file));
  const newHash = hashArray(lockHashes);

  if (existingLockHash && newHash != existingLockHash) {
    serverLogger.log(
      `[Server] lock file hash changed! old=${existingLockHash}, new=${newHash}`
    );
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

    if (err) {
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
  setupWorkspaceContext(workspaceRoot);

  const socketPath = getFullOsSocketPath();

  // Log daemon startup information for debugging
  serverLogger.log(`New daemon starting from: ${__filename}`);
  serverLogger.log(`New daemon __dirname: ${__dirname}`);
  serverLogger.log(`New daemon nxVersion: ${nxVersion}`);
  serverLogger.log(
    `New daemon getInstalledNxVersion(): ${getInstalledNxVersion()}`
  );

  // Persist metadata about the background process so that it can be cleaned up later if needed
  await writeDaemonJsonProcessCache({
    processId: process.pid,
    socketPath,
    nxVersion,
  });

  // See notes in socket-command-line-utils.ts on OS differences regarding clean up of existings connections.
  if (!isWindows) {
    killSocketOrPath();
  }

  serverLogger.log(`[Server] Starting outdated check interval (20ms)`);

  setInterval(() => {
    if (getDaemonProcessIdSync() !== process.pid) {
      return handleServerProcessTermination({
        server,
        reason: 'this process is no longer the current daemon (native)',
        sockets: openSockets,
      });
    }

    const outdated = daemonIsOutdated();
    if (outdated) {
      serverLogger.log(`[Server] Daemon outdated: ${outdated}`);
      if (outdated === 'LOCK_FILES_CHANGED') {
        // Lock file changes - restart daemon, clients will reconnect
        serverLogger.log('[Server] Restarting daemon...');
        handleServerProcessTerminationWithRestart({
          server,
          reason: outdated,
          sockets: openSockets,
        });
      } else {
        // Version changes or other reasons - just shut down, don't restart
        serverLogger.log('[Server] Shutting down daemon (no restart)...');
        handleServerProcessTermination({
          server,
          reason: outdated,
          sockets: openSockets,
        });
      }
    }
  }, 20).unref();

  return new Promise(async (resolve, reject) => {
    try {
      server.listen(socketPath, async () => {
        try {
          serverLogger.log(`Started listening on: ${socketPath}`);

          // this triggers the storage of the lock file hash
          daemonIsOutdated();

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
              await watchOutputFiles(server, handleOutputsChanges)
            );
          }

          // listen for project graph recomputation events to collect and schedule sync generators
          registerProjectGraphRecomputationListener(
            collectAndScheduleSyncGenerators
          );
          // register file change listener to invalidate sync generator cache
          registerFileChangeListener(clearSyncGeneratorsCache);
          // trigger an initial project graph recomputation
          addUpdatedAndDeletedFiles([], [], []);

          // Kick off Nx Console check in background to prime the cache
          handleGetNxConsoleStatus().catch(() => {
            // Ignore errors, this is a background operation
          });

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
function serializeUnserializedResult(
  response: boolean | object | number,
  mode: 'json' | 'v8'
) {
  if (mode === 'json') {
    return JSON.stringify(response);
  } else {
    return serialize(response).toString('binary');
  }
}
