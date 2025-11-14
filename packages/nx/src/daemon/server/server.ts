import { existsSync, statSync } from 'fs';
import { createServer, Server, Socket } from 'net';
import { join } from 'path';
import { PerformanceObserver } from 'perf_hooks';
import { hashArray } from '../../hasher/file-hasher.js';
import { hashFile } from '../../native/index.js';
import {
  consumeMessagesFromSocket,
  isJsonMessage,
} from '../../utils/consume-messages-from-socket.js';
import { readJsonFile } from '../../utils/fileutils.js';
import { PackageJson } from '../../utils/package-json.js';
import { nxVersion } from '../../utils/versions.js';
import { setupWorkspaceContext } from '../../utils/workspace-context.js';
import { workspaceRoot } from '../../utils/workspace-root.js';
import {
  getDaemonProcessIdSync,
  writeDaemonJsonProcessCache,
} from '../cache.js';
import {
  getFullOsSocketPath,
  isWindows,
  killSocketOrPath,
} from '../socket-utils.js';
import {
  hasRegisteredFileWatcherSockets,
  registeredFileWatcherSockets,
  removeRegisteredFileWatcherSocket,
} from './file-watching/file-watcher-sockets.js';
import {
  hasRegisteredProjectGraphListenerSockets,
  registeredProjectGraphListenerSockets,
  removeRegisteredProjectGraphListenerSocket,
} from './project-graph-listener-sockets.js';
import { handleHashTasks } from './handle-hash-tasks.js';
import {
  handleOutputsHashesMatch,
  handleRecordOutputsHash,
} from './handle-outputs-tracking.js';
import { handleProcessInBackground } from './handle-process-in-background.js';
import { handleRequestProjectGraph } from './handle-request-project-graph.js';
import { handleRequestShutdown } from './handle-request-shutdown.js';
import { serverLogger } from './logger.js';
import {
  disableOutputsTracking,
  processFileChangesInOutputs,
} from './outputs-tracking.js';
import {
  addUpdatedAndDeletedFiles,
  registerProjectGraphRecomputationListener,
} from './project-graph-incremental-recomputation.js';
import {
  getOutputWatcherInstance,
  getWatcherInstance,
  handleServerProcessTermination,
  resetInactivityTimeout,
  respondToClient,
  respondWithErrorAndExit,
  SERVER_INACTIVITY_TIMEOUT_MS,
  storeOutputWatcherInstance,
  storeWatcherInstance,
} from './shutdown-utils.js';
import {
  convertChangeEventsToLogMessage,
  FileWatcherCallback,
  watchOutputFiles,
  watchWorkspace,
} from './watcher.js';
import { handleGlob, handleMultiGlob } from './handle-glob.js';
import {
  GLOB,
  isHandleGlobMessage,
  isHandleMultiGlobMessage,
  MULTI_GLOB,
} from '../message-types/glob.js';
import {
  GET_NX_WORKSPACE_FILES,
  isHandleNxWorkspaceFilesMessage,
} from '../message-types/get-nx-workspace-files.js';
import { handleNxWorkspaceFiles } from './handle-nx-workspace-files.js';
import {
  GET_CONTEXT_FILE_DATA,
  isHandleContextFileDataMessage,
} from '../message-types/get-context-file-data.js';
import { handleContextFileData } from './handle-context-file-data.js';
import {
  GET_FILES_IN_DIRECTORY,
  isHandleGetFilesInDirectoryMessage,
} from '../message-types/get-files-in-directory.js';
import { handleGetFilesInDirectory } from './handle-get-files-in-directory.js';
import {
  HASH_GLOB,
  isHandleHashGlobMessage,
  isHandleHashMultiGlobMessage,
} from '../message-types/hash-glob.js';
import { handleHashGlob, handleHashMultiGlob } from './handle-hash-glob.js';
import {
  GET_ESTIMATED_TASK_TIMINGS,
  GET_FLAKY_TASKS,
  isHandleGetEstimatedTaskTimings,
  isHandleGetFlakyTasksMessage,
  isHandleWriteTaskRunsToHistoryMessage,
  RECORD_TASK_RUNS,
} from '../message-types/task-history.js';
import {
  handleRecordTaskRuns,
  handleGetFlakyTasks,
  handleGetEstimatedTaskTimings,
} from './handle-task-history.js';
import { isHandleForceShutdownMessage } from '../message-types/force-shutdown.js';
import { handleForceShutdown } from './handle-force-shutdown.js';
import {
  GET_SYNC_GENERATOR_CHANGES,
  isHandleGetSyncGeneratorChangesMessage,
} from '../message-types/get-sync-generator-changes.js';
import { handleGetSyncGeneratorChanges } from './handle-get-sync-generator-changes.js';
import { collectAndScheduleSyncGenerators } from './sync-generators.js';
import {
  GET_REGISTERED_SYNC_GENERATORS,
  isHandleGetRegisteredSyncGeneratorsMessage,
} from '../message-types/get-registered-sync-generators.js';
import { handleGetRegisteredSyncGenerators } from './handle-get-registered-sync-generators.js';
import {
  UPDATE_WORKSPACE_CONTEXT,
  isHandleUpdateWorkspaceContextMessage,
} from '../message-types/update-workspace-context.js';
import { handleUpdateWorkspaceContext } from './handle-update-workspace-context.js';
import {
  FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
  isHandleFlushSyncGeneratorChangesToDiskMessage,
} from '../message-types/flush-sync-generator-changes-to-disk.js';
import { handleFlushSyncGeneratorChangesToDisk } from './handle-flush-sync-generator-changes-to-disk.js';
import {
  isHandlePostTasksExecutionMessage,
  isHandlePreTasksExecutionMessage,
  POST_TASKS_EXECUTION,
  PRE_TASKS_EXECUTION,
} from '../message-types/run-tasks-execution-hooks.js';
import {
  handleRunPostTasksExecution,
  handleRunPreTasksExecution,
} from './handle-tasks-execution-hooks.js';
import {
  isRegisterProjectGraphListenerMessage,
  REGISTER_PROJECT_GRAPH_LISTENER,
} from '../message-types/register-project-graph-listener.js';
import { deserialize, serialize } from 'v8';

let performanceObserver: PerformanceObserver | undefined;
let workspaceWatcherError: Error | undefined;
let outputsWatcherError: Error | undefined;

global.NX_DAEMON = true;

export type HandlerResult = {
  description: string;
  error?: any;
  response?: string | object | boolean;
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

  const outdated = daemonIsOutdated();
  if (outdated) {
    await respondWithErrorAndExit(
      socket,
      `Daemon outdated`,
      new Error(outdated)
    );
  }

  resetInactivityTimeout(handleInactivityTimeout);

  const unparsedPayload = data;
  let payload;
  let mode: 'json' | 'v8' = 'json';
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
    const response =
      typeof hr.response === 'string'
        ? hr.response
        : serializeUnserializedResult(hr.response, mode);
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
  if (nxVersionChanged()) {
    return 'NX_VERSION_CHANGED';
  } else if (lockFileHashChanged()) {
    return 'LOCK_FILES_CHANGED';
  }
  return null;
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
    join(workspaceRoot, 'bun.lockb'),
    join(workspaceRoot, 'bun.lock'),
  ]
    .filter((file) => existsSync(file))
    .map((file) => hashFile(file));
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

    const outdatedReason = daemonIsOutdated();
    if (outdatedReason) {
      await handleServerProcessTermination({
        server,
        reason: outdatedReason,
        sockets: openSockets,
      });
      return;
    }

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
      server.listen(getFullOsSocketPath(), async () => {
        try {
          serverLogger.log(`Started listening on: ${getFullOsSocketPath()}`);

          setInterval(() => {
            if (getDaemonProcessIdSync() !== process.pid) {
              return handleServerProcessTermination({
                server,
                reason: 'this process is no longer the current daemon (native)',
                sockets: openSockets,
              });
            }
          }, 20).unref();

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
          // trigger an initial project graph recomputation
          addUpdatedAndDeletedFiles([], [], []);

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
  response: boolean | object,
  mode: 'json' | 'v8'
) {
  if (mode === 'json') {
    return JSON.stringify(response);
  } else {
    return serialize(response).toString('binary');
  }
}
