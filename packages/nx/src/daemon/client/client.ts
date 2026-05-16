import { ChildProcess, spawn } from 'child_process';
import { FileHandle, open } from 'fs/promises';
import { connect } from 'net';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { readNxJson } from '../../config/configuration';
import { hasNxJson, NxJsonConfiguration } from '../../config/nx-json';
import { FileData, ProjectGraph } from '../../config/project-graph';
import { Task, TaskGraph } from '../../config/task-graph';
import { Hash } from '../../hasher/task-hasher';
import { IS_WASM, NxWorkspaceFiles, TaskRun, TaskTarget } from '../../native';
import {
  DaemonProjectGraphError,
  ProjectGraphError,
} from '../../project-graph/error-types';
import {
  PostTasksExecutionContext,
  PreTasksExecutionContext,
} from '../../project-graph/plugins/public-api';
import { preventRecursionInGraphConstruction } from '../../project-graph/project-graph';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration/source-maps';
import { parseMessage } from '../../utils/consume-messages-from-socket';
import { DelayedSpinner } from '../../utils/delayed-spinner';
import { handleImport } from '../../utils/handle-import';
import { isCI } from '../../utils/is-ci';
import { isSandbox } from '../../utils/is-sandbox';
import { output } from '../../utils/output';
import { PromisedBasedQueue } from '../../utils/promised-based-queue';
import type {
  FlushSyncGeneratorChangesResult,
  SyncGeneratorRunResult,
} from '../../utils/sync-generators';
import { waitForSocketConnection } from '../../utils/wait-for-socket-connection';
import { workspaceRoot } from '../../utils/workspace-root';
import { getDaemonProcessIdSync, readDaemonProcessJsonCache } from '../cache';
import { isNxVersionMismatch } from '../is-nx-version-mismatch';
import { clientLogger } from '../logger';
import {
  type ConfigureAiAgentsStatusResponse,
  GET_CONFIGURE_AI_AGENTS_STATUS,
  type HandleGetConfigureAiAgentsStatusMessage,
  type HandleResetConfigureAiAgentsStatusMessage,
  RESET_CONFIGURE_AI_AGENTS_STATUS,
} from '../message-types/configure-ai-agents';
import { DaemonMessage } from '../message-types/daemon-message';
import {
  FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
  type HandleFlushSyncGeneratorChangesToDiskMessage,
} from '../message-types/flush-sync-generator-changes-to-disk';
import {
  GET_CONTEXT_FILE_DATA,
  HandleContextFileDataMessage,
} from '../message-types/get-context-file-data';
import {
  GET_FILES_IN_DIRECTORY,
  HandleGetFilesInDirectoryMessage,
} from '../message-types/get-files-in-directory';
import {
  GET_NX_WORKSPACE_FILES,
  HandleNxWorkspaceFilesMessage,
} from '../message-types/get-nx-workspace-files';
import {
  GET_REGISTERED_SYNC_GENERATORS,
  type HandleGetRegisteredSyncGeneratorsMessage,
} from '../message-types/get-registered-sync-generators';
import {
  GET_SYNC_GENERATOR_CHANGES,
  type HandleGetSyncGeneratorChangesMessage,
} from '../message-types/get-sync-generator-changes';
import {
  HandleGlobMessage,
  HandleMultiGlobMessage,
} from '../message-types/glob';
import {
  HandleHashGlobMessage,
  HandleHashMultiGlobMessage,
  HASH_GLOB,
  HASH_MULTI_GLOB,
} from '../message-types/hash-glob';
import {
  GET_NX_CONSOLE_STATUS,
  type HandleGetNxConsoleStatusMessage,
  type HandleSetNxConsolePreferenceAndInstallMessage,
  type NxConsoleStatusResponse,
  SET_NX_CONSOLE_PREFERENCE_AND_INSTALL,
  type SetNxConsolePreferenceAndInstallResponse,
} from '../message-types/nx-console';
import { REGISTER_PROJECT_GRAPH_LISTENER } from '../message-types/register-project-graph-listener';
import {
  HandlePostTasksExecutionMessage,
  HandlePreTasksExecutionMessage,
  POST_TASKS_EXECUTION,
  PRE_TASKS_EXECUTION,
} from '../message-types/run-tasks-execution-hooks';
import {
  isEmitLogMessage,
  isUpdateProgressMessage,
} from '../message-types/streaming-messages';
import {
  GET_ESTIMATED_TASK_TIMINGS,
  GET_FLAKY_TASKS,
  HandleGetEstimatedTaskTimings,
  HandleGetFlakyTasks,
  HandleRecordTaskRunsMessage,
  RECORD_TASK_RUNS,
} from '../message-types/task-history';
import {
  type HandleUpdateWorkspaceContextMessage,
  UPDATE_WORKSPACE_CONTEXT,
} from '../message-types/update-workspace-context';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  DAEMON_OUTPUT_LOG_FILE,
  isDaemonDisabled,
  removeSocketDir,
} from '../tmp-dir';
import {
  DaemonSocketMessenger,
  VersionMismatchError,
} from './daemon-socket-messenger';

import { getDaemonEnv } from './daemon-environment';

export type UnregisterCallback = () => void;
export type ChangedFile = {
  path: string;
  type: 'create' | 'update' | 'delete';
};

enum DaemonStatus {
  CONNECTING,
  DISCONNECTED,
  CONNECTED,
}

const WAIT_FOR_SERVER_CONFIG = {
  delayMs: 10,
  maxAttempts: 6000, // 6000 * 10ms = 60 seconds
};

export class DaemonClient {
  private readonly nxJson: NxJsonConfiguration | null;

  constructor() {
    try {
      this.nxJson = readNxJson();
    } catch (e) {
      this.nxJson = null;
    }
    this.reset();
  }

  private queue: PromisedBasedQueue;
  private socketMessenger: DaemonSocketMessenger;

  private currentMessage;
  private currentResolve;
  private currentReject;
  // Tracks the spinner owned by the in-flight request so streamed
  // progress updates are routed to the caller's spinner instead of
  // mutating the process-wide globalSpinner (which may belong to an
  // unrelated command).
  private currentSpinner: DelayedSpinner | null = null;

  private _enabled: boolean | undefined;
  private _daemonStatus: DaemonStatus = DaemonStatus.DISCONNECTED;
  private _waitForDaemonReady: Promise<void> | null = null;
  private _daemonReady: () => void | null = null;
  private _out: FileHandle = null;
  private _err: FileHandle = null;

  // Shared file watcher connection state
  private fileWatcherMessenger: DaemonSocketMessenger | undefined;
  private fileWatcherReconnecting: boolean = false;
  private fileWatcherCallbacks: Map<
    string,
    (
      error: Error | null | 'reconnecting' | 'reconnected' | 'closed',
      data: {
        changedProjects: string[];
        changedFiles: ChangedFile[];
      } | null
    ) => void
  > = new Map();
  private fileWatcherConfigs: Map<
    string,
    {
      watchProjects: string[] | 'all';
      includeGlobalWorkspaceFiles?: boolean;
      includeDependencies?: boolean;
      allowPartialGraph?: boolean;
    }
  > = new Map();

  // Shared project graph listener connection state
  private projectGraphListenerMessenger: DaemonSocketMessenger | undefined;
  private projectGraphListenerReconnecting: boolean = false;
  private projectGraphListenerCallbacks: Map<
    string,
    (
      error: Error | null | 'reconnecting' | 'reconnected' | 'closed',
      data: {
        projectGraph: ProjectGraph;
        sourceMaps: ConfigurationSourceMaps;
        error: Error | null;
      } | null
    ) => void
  > = new Map();

  enabled() {
    if (this._enabled === undefined) {
      const useDaemonProcessOption = this.nxJson?.useDaemonProcess;
      const env = process.env.NX_DAEMON;

      // env takes precedence
      // option=true,env=false => no daemon
      // option=false,env=undefined => no daemon
      // option=false,env=false => no daemon

      // option=undefined,env=undefined => daemon
      // option=true,env=true => daemon
      // option=false,env=true => daemon

      // CI=true,env=undefined => no daemon
      // CI=true,env=false => no daemon
      // CI=true,env=true => daemon

      // docker=true,env=undefined => no daemon
      // docker=true,env=false => no daemon
      // docker=true,env=true => daemon
      // WASM => no daemon because file watching does not work
      // version mismatch => no daemon because the installed nx version differs from the running one
      if (
        isNxVersionMismatch() ||
        ((isCI() || isDocker() || isSandbox()) && env !== 'true') ||
        isDaemonDisabled() ||
        nxJsonIsNotPresent() ||
        (useDaemonProcessOption === undefined && env === 'false') ||
        (useDaemonProcessOption === true && env === 'false') ||
        (useDaemonProcessOption === false && env === undefined) ||
        (useDaemonProcessOption === false && env === 'false')
      ) {
        this._enabled = false;
      } else if (IS_WASM) {
        output.warn({
          title:
            'The Nx Daemon is unsupported in WebAssembly environments. Some things may be slower than or not function as expected.',
        });
        this._enabled = false;
      } else {
        this._enabled = true;
      }
    }
    return this._enabled;
  }

  reset() {
    this.socketMessenger?.close();
    this.socketMessenger = null;
    this.queue = new PromisedBasedQueue();
    this.currentMessage = null;
    this.currentResolve = null;
    this.currentReject = null;
    this._enabled = undefined;

    this._out?.close();
    this._err?.close();
    this._out = null;
    this._err = null;

    // Clean up file watcher and project graph listener connections
    this.fileWatcherMessenger?.close();
    this.fileWatcherMessenger = undefined;
    this.projectGraphListenerMessenger?.close();
    this.projectGraphListenerMessenger = undefined;

    this._daemonStatus = DaemonStatus.DISCONNECTED;
    this._waitForDaemonReady = new Promise<void>(
      (resolve) => (this._daemonReady = resolve)
    );
  }

  private getSocketPath(): string {
    const daemonProcessJson = readDaemonProcessJsonCache();

    if (daemonProcessJson?.socketPath) {
      return daemonProcessJson.socketPath;
    } else {
      throw daemonProcessException(
        'Unable to connect to daemon: no socket path available'
      );
    }
  }

  async requestShutdown(): Promise<void> {
    return this.sendToDaemonViaQueue({ type: 'REQUEST_SHUTDOWN' });
  }

  async getProjectGraphAndSourceMaps(): Promise<{
    projectGraph: ProjectGraph;
    sourceMaps: ConfigurationSourceMaps;
  }> {
    preventRecursionInGraphConstruction();
    let spinner: DelayedSpinner;
    // If the graph takes a while to load, we want to show a spinner.
    spinner = new DelayedSpinner(
      'Calculating the project graph on the Nx Daemon'
    );
    this.currentSpinner = spinner;
    try {
      const response = await this.sendToDaemonViaQueue({
        type: 'REQUEST_PROJECT_GRAPH',
      });
      return {
        projectGraph: response.projectGraph,
        sourceMaps: response.sourceMaps,
      };
    } catch (e) {
      if (e.name === DaemonProjectGraphError.name) {
        throw ProjectGraphError.fromDaemonProjectGraphError(e);
      } else {
        throw e;
      }
    } finally {
      spinner?.cleanup();
      this.currentSpinner = null;
    }
  }

  async getAllFileData(): Promise<FileData[]> {
    return await this.sendToDaemonViaQueue({ type: 'REQUEST_FILE_DATA' });
  }

  hashTasks(
    runnerOptions: any,
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd: string,
    collectInputs?: boolean
  ): Promise<Hash[]> {
    return this.sendToDaemonViaQueue({
      type: 'HASH_TASKS',
      runnerOptions,
      perTaskEnvs,
      tasks,
      taskGraph,
      cwd,
      collectInputs,
    });
  }

  async registerFileWatcher(
    config: {
      watchProjects: string[] | 'all';
      includeGlobalWorkspaceFiles?: boolean;
      includeDependencies?: boolean;
      allowPartialGraph?: boolean;
    },
    callback: (
      error: Error | null | 'reconnecting' | 'reconnected' | 'closed',
      data: {
        changedProjects: string[];
        changedFiles: ChangedFile[];
      } | null
    ) => void
  ): Promise<UnregisterCallback> {
    try {
      await this.getProjectGraphAndSourceMaps();
    } catch (e) {
      if (config.allowPartialGraph && e instanceof ProjectGraphError) {
        // we are fine with partial graph
      } else {
        throw e;
      }
    }

    // Generate unique ID for this callback
    const callbackId = Math.random().toString(36).substring(2, 11);

    // Store callback and config for reconnection
    this.fileWatcherCallbacks.set(callbackId, callback);
    this.fileWatcherConfigs.set(callbackId, config);

    await this.queue.sendToQueue(async () => {
      // If we already have a connection, just register the new config
      if (this.fileWatcherMessenger) {
        this.fileWatcherMessenger.sendMessage({
          type: 'REGISTER_FILE_WATCHER',
          config,
        });
        return;
      }

      await this.startDaemonIfNecessary();

      const socketPath = this.getSocketPath();

      this.fileWatcherMessenger = new DaemonSocketMessenger(
        connect(socketPath)
      ).listen(
        (message) => {
          try {
            const parsedMessage = parseMessage<any>(message);
            // Notify all callbacks
            for (const cb of this.fileWatcherCallbacks.values()) {
              cb(null, parsedMessage);
            }
          } catch (e) {
            for (const cb of this.fileWatcherCallbacks.values()) {
              cb(e, null);
            }
          }
        },
        () => {
          // Connection closed - trigger reconnection
          clientLogger.log(
            `[FileWatcher] Socket closed, triggering reconnection`
          );
          this.fileWatcherMessenger = undefined;
          for (const cb of this.fileWatcherCallbacks.values()) {
            cb('reconnecting', null);
          }
          this.reconnectFileWatcher();
        },
        (err) => {
          if (err instanceof VersionMismatchError) {
            for (const cb of this.fileWatcherCallbacks.values()) {
              cb('closed', null);
            }
            process.exit(1);
          }
          for (const cb of this.fileWatcherCallbacks.values()) {
            cb(err, null);
          }
        }
      );
      this.fileWatcherMessenger.sendMessage({
        type: 'REGISTER_FILE_WATCHER',
        config,
      });
    });

    // Return unregister function
    return () => {
      this.fileWatcherCallbacks.delete(callbackId);
      this.fileWatcherConfigs.delete(callbackId);

      // If no more callbacks, close the connection
      if (this.fileWatcherCallbacks.size === 0) {
        this.fileWatcherMessenger?.close();
        this.fileWatcherMessenger = undefined;
      }
    };
  }

  private async reconnectFileWatcher() {
    // Guard against concurrent reconnection attempts
    if (this.fileWatcherReconnecting) {
      return;
    }

    if (this.fileWatcherCallbacks.size === 0) {
      return; // No callbacks to reconnect
    }

    this.fileWatcherReconnecting = true;
    clientLogger.log(
      `[FileWatcher] Starting reconnection for ${this.fileWatcherCallbacks.size} callbacks`
    );

    // Wait for daemon server to be available before trying to reconnect
    let serverAvailable: boolean;
    try {
      serverAvailable = await this.waitForServerToBeAvailable({
        ignoreVersionMismatch: false,
      });
    } catch (err) {
      // Version mismatch - pass error to callbacks so they can handle it
      clientLogger.log(
        `[FileWatcher] Error during reconnection: ${err.message}`
      );
      this.fileWatcherReconnecting = false;
      for (const cb of this.fileWatcherCallbacks.values()) {
        cb(err, null);
      }
      return;
    }

    if (!serverAvailable) {
      // Failed to reconnect after all attempts - notify as closed
      clientLogger.log(
        `[FileWatcher] Failed to reconnect - server unavailable`
      );
      this.fileWatcherReconnecting = false;
      for (const cb of this.fileWatcherCallbacks.values()) {
        cb('closed', null);
      }
      return;
    }

    try {
      // Try to reconnect
      const socketPath = this.getSocketPath();
      this.fileWatcherMessenger = new DaemonSocketMessenger(
        connect(socketPath)
      ).listen(
        (message) => {
          try {
            const parsedMessage = parseMessage<any>(message);
            for (const cb of this.fileWatcherCallbacks.values()) {
              cb(null, parsedMessage);
            }
          } catch (e) {
            for (const cb of this.fileWatcherCallbacks.values()) {
              cb(e, null);
            }
          }
        },
        () => {
          // Connection closed - trigger reconnection again
          this.fileWatcherMessenger = undefined;
          // Reset reconnection flag before triggering reconnection
          this.fileWatcherReconnecting = false;
          for (const cb of this.fileWatcherCallbacks.values()) {
            cb('reconnecting', null);
          }
          this.reconnectFileWatcher();
        },
        (err) => {
          if (err instanceof VersionMismatchError) {
            for (const cb of this.fileWatcherCallbacks.values()) {
              cb('closed', null);
            }
            process.exit(1);
          }
          // Other errors during reconnection - let retry loop handle
        }
      );

      // Re-register all stored configs
      for (const cfg of this.fileWatcherConfigs.values()) {
        this.fileWatcherMessenger.sendMessage({
          type: 'REGISTER_FILE_WATCHER',
          config: cfg,
        });
      }

      // Successfully reconnected - notify callbacks
      clientLogger.log(`[FileWatcher] Reconnected successfully`);
      for (const cb of this.fileWatcherCallbacks.values()) {
        cb('reconnected', null);
      }
      this.fileWatcherReconnecting = false;
    } catch (e) {
      // Failed to reconnect - notify as closed
      clientLogger.log(`[FileWatcher] Reconnection failed: ${e.message}`);
      this.fileWatcherReconnecting = false;
      for (const cb of this.fileWatcherCallbacks.values()) {
        cb('closed', null);
      }
    }
  }

  async registerProjectGraphRecomputationListener(
    callback: (
      error: Error | null | 'reconnecting' | 'reconnected' | 'closed',
      data: {
        projectGraph: ProjectGraph;
        sourceMaps: ConfigurationSourceMaps;
        error: Error | null;
      } | null
    ) => void
  ): Promise<UnregisterCallback> {
    // Generate unique ID for this callback
    const callbackId = Math.random().toString(36).substring(2, 11);

    // Store callback
    this.projectGraphListenerCallbacks.set(callbackId, callback);

    await this.queue.sendToQueue(async () => {
      // If we already have a connection, just send the registration
      if (this.projectGraphListenerMessenger) {
        this.projectGraphListenerMessenger.sendMessage({
          type: REGISTER_PROJECT_GRAPH_LISTENER,
        });
        return;
      }

      await this.startDaemonIfNecessary();

      const socketPath = this.getSocketPath();

      this.projectGraphListenerMessenger = new DaemonSocketMessenger(
        connect(socketPath)
      ).listen(
        (message) => {
          try {
            const parsedMessage = parseMessage<any>(message);
            // Notify all callbacks
            for (const cb of this.projectGraphListenerCallbacks.values()) {
              cb(null, parsedMessage);
            }
          } catch (e) {
            for (const cb of this.projectGraphListenerCallbacks.values()) {
              cb(e, null);
            }
          }
        },
        () => {
          // Connection closed - trigger reconnection
          clientLogger.log(
            `[ProjectGraphListener] Socket closed, triggering reconnection`
          );
          this.projectGraphListenerMessenger = undefined;
          for (const cb of this.projectGraphListenerCallbacks.values()) {
            cb('reconnecting', null);
          }
          this.reconnectProjectGraphListener();
        },
        (err) => {
          if (err instanceof VersionMismatchError) {
            for (const cb of this.projectGraphListenerCallbacks.values()) {
              cb('closed', null);
            }
            process.exit(1);
          }
          for (const cb of this.projectGraphListenerCallbacks.values()) {
            cb(err, null);
          }
        }
      );
      this.projectGraphListenerMessenger.sendMessage({
        type: REGISTER_PROJECT_GRAPH_LISTENER,
      });
    });

    // Return unregister function
    return () => {
      this.projectGraphListenerCallbacks.delete(callbackId);

      // If no more callbacks, close the connection
      if (this.projectGraphListenerCallbacks.size === 0) {
        this.projectGraphListenerMessenger?.close();
        this.projectGraphListenerMessenger = undefined;
      }
    };
  }

  private async reconnectProjectGraphListener() {
    // Guard against concurrent reconnection attempts
    if (this.projectGraphListenerReconnecting) {
      return;
    }

    if (this.projectGraphListenerCallbacks.size === 0) {
      return; // No callbacks to reconnect
    }

    this.projectGraphListenerReconnecting = true;
    clientLogger.log(
      `[ProjectGraphListener] Starting reconnection for ${this.projectGraphListenerCallbacks.size} callbacks`
    );

    // Wait for daemon server to be available before trying to reconnect
    let serverAvailable: boolean;
    try {
      serverAvailable = await this.waitForServerToBeAvailable({
        ignoreVersionMismatch: false,
      });
    } catch (err) {
      // Version mismatch - pass error to callbacks so they can handle it
      clientLogger.log(
        `[ProjectGraphListener] Error during reconnection: ${err.message}`
      );
      this.projectGraphListenerReconnecting = false;
      for (const cb of this.projectGraphListenerCallbacks.values()) {
        cb(err, null);
      }
      return;
    }

    if (!serverAvailable) {
      // Failed to reconnect after all attempts - notify as closed
      clientLogger.log(
        `[ProjectGraphListener] Failed to reconnect - server unavailable`
      );
      this.projectGraphListenerReconnecting = false;
      for (const cb of this.projectGraphListenerCallbacks.values()) {
        cb('closed', null);
      }
      return;
    }

    try {
      const socketPath = this.getSocketPath();

      // Try to reconnect
      this.projectGraphListenerMessenger = new DaemonSocketMessenger(
        connect(socketPath)
      ).listen(
        (message) => {
          try {
            const parsedMessage = parseMessage<any>(message);
            for (const cb of this.projectGraphListenerCallbacks.values()) {
              cb(null, parsedMessage);
            }
          } catch (e) {
            for (const cb of this.projectGraphListenerCallbacks.values()) {
              cb(e, null);
            }
          }
        },
        () => {
          // Connection closed - trigger reconnection again
          this.projectGraphListenerMessenger = undefined;
          // Reset reconnection flag before triggering reconnection
          this.projectGraphListenerReconnecting = false;
          for (const cb of this.projectGraphListenerCallbacks.values()) {
            cb('reconnecting', null);
          }
          this.reconnectProjectGraphListener();
        },
        (err) => {
          if (err instanceof VersionMismatchError) {
            for (const cb of this.projectGraphListenerCallbacks.values()) {
              cb('closed', null);
            }
            process.exit(1);
          }
          // Other errors during reconnection - let retry loop handle
        }
      );

      // Re-register
      this.projectGraphListenerMessenger.sendMessage({
        type: REGISTER_PROJECT_GRAPH_LISTENER,
      });

      // Successfully reconnected - notify callbacks
      clientLogger.log(`[ProjectGraphListener] Reconnected successfully`);
      for (const cb of this.projectGraphListenerCallbacks.values()) {
        cb('reconnected', null);
      }
      this.projectGraphListenerReconnecting = false;
    } catch (e) {
      // Failed to reconnect - notify as closed
      clientLogger.log(
        `[ProjectGraphListener] Reconnection failed: ${e.message}`
      );
      this.projectGraphListenerReconnecting = false;
      for (const cb of this.projectGraphListenerCallbacks.values()) {
        cb('closed', null);
      }
    }
  }

  processInBackground(requirePath: string, data: any): Promise<any> {
    return this.sendToDaemonViaQueue(
      {
        type: 'PROCESS_IN_BACKGROUND',
        requirePath,
        data,
      },
      // This method is sometimes passed data that cannot be serialized with v8
      // so we force JSON serialization here
      'json'
    );
  }

  recordOutputsHashBatch(
    entries: { outputs: string[]; hash: string }[]
  ): Promise<any> {
    return this.sendToDaemonViaQueue({
      type: 'RECORD_OUTPUTS_HASH_BATCH',
      data: entries,
    });
  }

  outputsHashesMatchBatch(
    entries: { outputs: string[]; hash: string }[]
  ): Promise<boolean[]> {
    return this.sendToDaemonViaQueue({
      type: 'OUTPUTS_HASHES_MATCH_BATCH',
      data: entries,
    });
  }

  glob(globs: string[], exclude?: string[]): Promise<string[]> {
    const message: HandleGlobMessage = {
      type: 'GLOB',
      globs,
      exclude,
    };
    return this.sendToDaemonViaQueue(message);
  }

  multiGlob(globs: string[], exclude?: string[]): Promise<string[][]> {
    const message: HandleMultiGlobMessage = {
      type: 'MULTI_GLOB',
      globs,
      exclude,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getWorkspaceContextFileData(): Promise<FileData[]> {
    const message: HandleContextFileDataMessage = {
      type: GET_CONTEXT_FILE_DATA,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getWorkspaceFiles(
    projectRootMap: Record<string, string>
  ): Promise<NxWorkspaceFiles> {
    const message: HandleNxWorkspaceFilesMessage = {
      type: GET_NX_WORKSPACE_FILES,
      projectRootMap,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getFilesInDirectory(dir: string): Promise<string[]> {
    const message: HandleGetFilesInDirectoryMessage = {
      type: GET_FILES_IN_DIRECTORY,
      dir,
    };
    return this.sendToDaemonViaQueue(message);
  }

  hashGlob(globs: string[], exclude?: string[]): Promise<string> {
    const message: HandleHashGlobMessage = {
      type: HASH_GLOB,
      globs,
      exclude,
    };
    return this.sendToDaemonViaQueue(message);
  }

  hashMultiGlob(globGroups: string[][]): Promise<string[]> {
    const message: HandleHashMultiGlobMessage = {
      type: HASH_MULTI_GLOB,
      globGroups: globGroups,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getFlakyTasks(hashes: string[]): Promise<string[]> {
    const message: HandleGetFlakyTasks = {
      type: GET_FLAKY_TASKS,
      hashes,
    };

    return this.sendToDaemonViaQueue(message);
  }

  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    const message: HandleGetEstimatedTaskTimings = {
      type: GET_ESTIMATED_TASK_TIMINGS,
      targets,
    };

    return this.sendToDaemonViaQueue(message);
  }

  recordTaskRuns(taskRuns: TaskRun[]): Promise<void> {
    const message: HandleRecordTaskRunsMessage = {
      type: RECORD_TASK_RUNS,
      taskRuns,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getSyncGeneratorChanges(
    generators: string[]
  ): Promise<SyncGeneratorRunResult[]> {
    const message: HandleGetSyncGeneratorChangesMessage = {
      type: GET_SYNC_GENERATOR_CHANGES,
      generators,
    };
    return this.sendToDaemonViaQueue(message);
  }

  flushSyncGeneratorChangesToDisk(
    generators: string[]
  ): Promise<FlushSyncGeneratorChangesResult> {
    const message: HandleFlushSyncGeneratorChangesToDiskMessage = {
      type: FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
      generators,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getRegisteredSyncGenerators(): Promise<{
    globalGenerators: string[];
    taskGenerators: string[];
  }> {
    const message: HandleGetRegisteredSyncGeneratorsMessage = {
      type: GET_REGISTERED_SYNC_GENERATORS,
    };
    return this.sendToDaemonViaQueue(message);
  }

  updateWorkspaceContext(
    createdFiles: string[],
    updatedFiles: string[],
    deletedFiles: string[]
  ): Promise<void> {
    const message: HandleUpdateWorkspaceContextMessage = {
      type: UPDATE_WORKSPACE_CONTEXT,
      createdFiles,
      updatedFiles,
      deletedFiles,
    };
    return this.sendToDaemonViaQueue(message);
  }

  async runPreTasksExecution(
    context: PreTasksExecutionContext
  ): Promise<NodeJS.ProcessEnv[]> {
    const message: HandlePreTasksExecutionMessage = {
      type: PRE_TASKS_EXECUTION,
      context,
    };
    return this.sendToDaemonViaQueue(message);
  }

  async runPostTasksExecution(
    context: PostTasksExecutionContext
  ): Promise<void> {
    const message: HandlePostTasksExecutionMessage = {
      type: POST_TASKS_EXECUTION,
      context,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getNxConsoleStatus(): Promise<NxConsoleStatusResponse> {
    const message: HandleGetNxConsoleStatusMessage = {
      type: GET_NX_CONSOLE_STATUS,
    };
    return this.sendToDaemonViaQueue(message);
  }

  setNxConsolePreferenceAndInstall(
    preference: boolean
  ): Promise<SetNxConsolePreferenceAndInstallResponse> {
    const message: HandleSetNxConsolePreferenceAndInstallMessage = {
      type: SET_NX_CONSOLE_PREFERENCE_AND_INSTALL,
      preference,
    };
    return this.sendToDaemonViaQueue(message);
  }

  getConfigureAiAgentsStatus(): Promise<ConfigureAiAgentsStatusResponse> {
    const message: HandleGetConfigureAiAgentsStatusMessage = {
      type: GET_CONFIGURE_AI_AGENTS_STATUS,
    };
    return this.sendToDaemonViaQueue(message);
  }

  resetConfigureAiAgentsStatus(): Promise<{ success: boolean }> {
    const message: HandleResetConfigureAiAgentsStatusMessage = {
      type: RESET_CONFIGURE_AI_AGENTS_STATUS,
    };
    return this.sendToDaemonViaQueue(message);
  }

  async isServerAvailable(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const socketPath = this.getSocketPath();
        if (!socketPath) {
          resolve(false);
          return;
        }
        const socket = connect(socketPath, () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => {
          resolve(false);
        });
      } catch (err) {
        if (err instanceof VersionMismatchError) {
          reject(err); // Let version mismatch bubble up
        }
        resolve(false);
      }
    });
  }

  private async startDaemonIfNecessary() {
    if (this._daemonStatus == DaemonStatus.CONNECTED) {
      return;
    }
    // Ensure daemon is running and socket path is available
    if (this._daemonStatus == DaemonStatus.DISCONNECTED) {
      this._daemonStatus = DaemonStatus.CONNECTING;

      let daemonPid: number | null = null;
      let serverAvailable: boolean;
      try {
        serverAvailable = await this.isServerAvailable();
      } catch (err) {
        // Version mismatch - treat as server not available, start new one
        if (err instanceof VersionMismatchError) {
          serverAvailable = false;
        } else {
          throw err;
        }
      }
      if (!serverAvailable) {
        daemonPid = await this.startInBackground();
      }
      this.setUpConnection();
      this._daemonStatus = DaemonStatus.CONNECTED;
      this._daemonReady();

      daemonPid ??= getDaemonProcessIdSync();
      // Fire-and-forget - don't block daemon connection by waiting for metrics registration
      this.registerDaemonProcessWithMetricsService(daemonPid);
    } else if (this._daemonStatus == DaemonStatus.CONNECTING) {
      await this._waitForDaemonReady;
      const daemonPid = getDaemonProcessIdSync();
      // Fire-and-forget - don't block daemon connection by waiting for metrics registration
      this.registerDaemonProcessWithMetricsService(daemonPid);
    }
  }

  private async sendToDaemonViaQueue<T extends DaemonMessage>(
    messageToDaemon: T,
    parser?: 'v8' | 'json'
  ): Promise<any> {
    return this.queue.sendToQueue(async () => {
      // Set currentSpinner inside the queued function so it's only
      // active while this specific message is in flight — preventing
      // concurrent callers from overwriting each other's spinner
      // reference before their turn arrives.
      return await this.sendMessageToDaemon(messageToDaemon, parser);
    });
  }

  private setUpConnection() {
    const socketPath = this.getSocketPath();

    const socket = connect(socketPath);
    // Unref the socket so it doesn't keep the process alive. The
    // sendMessageToDaemon method uses a keep-alive setTimeout to
    // explicitly hold the event loop open while awaiting a response.
    socket.unref();
    this.socketMessenger = new DaemonSocketMessenger(socket).listen(
      (message) => this.handleMessage(message),
      () => {
        // it's ok for the daemon to terminate if the client doesn't wait on
        // any messages from the daemon
        if (this.queue.isEmpty()) {
          this.reset();
        } else {
          // Connection closed while we had pending work - try to reconnect
          this._daemonStatus = DaemonStatus.DISCONNECTED;
          this.handleConnectionError(
            daemonProcessException(
              'Daemon process terminated and closed the connection'
            )
          );
        }
      },
      (err) => {
        if (!err.message) {
          return this.currentReject(daemonProcessException(err.toString()));
        }

        let error: any;
        if (err.message.startsWith('connect ENOENT')) {
          error = daemonProcessException('The Daemon Server is not running');
        } else if (err.message.startsWith('connect ECONNREFUSED')) {
          error = daemonProcessException(
            `A server instance had not been fully shut down. Please try running the command again.`
          );
        } else if (err.message.startsWith('read ECONNRESET')) {
          error = daemonProcessException(
            `Unable to connect to the daemon process.`
          );
        } else {
          error = daemonProcessException(err.toString());
        }
        this.currentReject(error);
      }
    );
  }

  private async handleConnectionError(error: Error) {
    clientLogger.log(`[Reconnect] Connection error detected: ${error.message}`);

    // Create a new ready promise for new requests to wait on
    this._waitForDaemonReady = new Promise<void>(
      (resolve) => (this._daemonReady = resolve)
    );

    // Set status to CONNECTING so new requests will wait for reconnection
    this._daemonStatus = DaemonStatus.CONNECTING;

    let serverAvailable: boolean;
    try {
      serverAvailable = await this.waitForServerToBeAvailable({
        ignoreVersionMismatch: false,
      });
    } catch (err) {
      if (err instanceof VersionMismatchError) {
        // New daemon has different version - reject with error so caller can handle
        if (this.currentReject) {
          this.currentReject(err);
        }
        return;
      }
      throw err;
    }

    if (serverAvailable) {
      clientLogger.log(
        `[Reconnect] Reconnection successful, re-establishing connection`
      );
      // Server is back up, establish connection and signal ready
      this.establishConnection();

      // Resend the pending message if one exists
      if (this.currentMessage && this.currentResolve && this.currentReject) {
        // Retry the message directly (not through the queue) to resolve the
        // pending promise that the original queue entry is waiting on.
        // This allows the original queue entry to complete naturally.
        const msg = this.currentMessage;
        const res = this.currentResolve;
        const rej = this.currentReject;
        this.sendMessageToDaemon(msg).then(res, rej);
      }
    } else {
      // Failed to reconnect after all attempts, reject the pending request
      if (this.currentReject) {
        this.currentReject(error);
      }
    }
  }

  private establishConnection() {
    this._daemonStatus = DaemonStatus.DISCONNECTED;
    this.setUpConnection();
    this._daemonStatus = DaemonStatus.CONNECTED;
    this._daemonReady();
  }

  /**
   * Wait for daemon server to be available.
   * Used for reconnection - throws VersionMismatchError if daemon version differs.
   */
  private async waitForServerToBeAvailable(options: {
    ignoreVersionMismatch: boolean;
  }): Promise<boolean> {
    clientLogger.log(
      `[Client] Waiting for server (max: ${WAIT_FOR_SERVER_CONFIG.maxAttempts} attempts, ${WAIT_FOR_SERVER_CONFIG.delayMs}ms interval)`
    );

    const socket = await waitForSocketConnection(
      () => {
        try {
          return this.getSocketPath();
        } catch (err) {
          if (err instanceof VersionMismatchError) {
            if (!options.ignoreVersionMismatch) {
              throw err;
            }
          }
          // Socket path not available yet — keep polling
          return null;
        }
      },
      {
        maxAttempts: WAIT_FOR_SERVER_CONFIG.maxAttempts,
        delayMs: WAIT_FOR_SERVER_CONFIG.delayMs,
      }
    );

    if (socket) {
      socket.destroy();
      clientLogger.log(`[Client] Server available`);
      return true;
    }

    clientLogger.log(
      `[Client] Server not available after ${WAIT_FOR_SERVER_CONFIG.maxAttempts} attempts`
    );
    return false;
  }

  private envReflectionSent = false;
  private async sendMessageToDaemon(
    message: DaemonMessage,
    force?: 'v8' | 'json'
  ): Promise<any> {
    // the first message sent to the daemon includes an env prop
    // that updates the process.env values on the daemon.
    if (!this.envReflectionSent && !global.NX_PLUGIN_WORKER) {
      message.env = getDaemonEnv();
      this.envReflectionSent = true;
    }
    await this.startDaemonIfNecessary();

    let keepAlive: NodeJS.Timeout;
    return new Promise((resolve, reject) => {
      performance.mark('sendMessageToDaemon-start');

      // An open promise isn't enough to keep the event loop
      // alive, so we set a timeout here and clear it when we hear
      // back. This **must** be longer than the message timeout used
      // in the plugin isolation messages, or the daemon will timeout before
      // a plugin worker would, and that can result in odd exit behavior.
      keepAlive = setTimeout(
        () => {
          reject(
            new Error('The daemon timed out while processing ' + message.type)
          );
        },
        20 * 60 * 1000
      );

      this.currentMessage = message;
      this.currentResolve = resolve;
      this.currentReject = reject;

      this.socketMessenger.sendMessage(message, force);
    }).finally(() => {
      clearTimeout(keepAlive);
    });
  }

  private async registerDaemonProcessWithMetricsService(
    daemonPid: number | null
  ) {
    if (!daemonPid) {
      return;
    }

    try {
      const { getProcessMetricsService } = await handleImport(
        '../../tasks-runner/process-metrics-service.js',
        __dirname
      );
      getProcessMetricsService().registerDaemonProcess(daemonPid);
    } catch {
      // don't error, this is a secondary concern that should not break task execution
    }
  }

  private handleMessage(serializedResult: string) {
    try {
      performance.mark('result-parse-start-' + this.currentMessage.type);
      const parsedResult = parseMessage<any>(serializedResult);
      performance.mark('result-parse-end-' + this.currentMessage.type);
      performance.measure(
        'deserialize daemon response - ' + this.currentMessage.type,
        'result-parse-start-' + this.currentMessage.type,
        'result-parse-end-' + this.currentMessage.type
      );
      // Streaming messages fire side-effects on the client but do not
      // resolve the pending request promise — the daemon can push several
      // of these before finally sending the real response. Progress
      // updates route through the in-flight request's own spinner so
      // we don't stomp on unrelated commands' spinner text.
      if (isUpdateProgressMessage(parsedResult)) {
        this.currentSpinner?.setMessage(parsedResult.message);
        return;
      }
      if (isEmitLogMessage(parsedResult)) {
        console[parsedResult.level](parsedResult.message);
        return;
      }
      if (parsedResult.error) {
        this.currentReject(parsedResult.error);
      } else {
        performance.measure(
          `${this.currentMessage.type} round trip`,
          'sendMessageToDaemon-start',
          'result-parse-end-' + this.currentMessage.type
        );

        return this.currentResolve(parsedResult);
      }
    } catch (e) {
      const endOfResponse =
        serializedResult.length > 300
          ? serializedResult.substring(serializedResult.length - 300)
          : serializedResult;
      this.currentReject(
        daemonProcessException(
          [
            'Could not deserialize response from Nx daemon.',
            `Message: ${e.message}`,
            '\n',
            `Received:`,
            endOfResponse,
            '\n',
          ].join('\n')
        )
      );
    }
  }

  async startInBackground(): Promise<ChildProcess['pid']> {
    if (global.NX_PLUGIN_WORKER) {
      throw new Error(
        'Fatal Error: Something unexpected has occurred. Plugin Workers should not start a new daemon process. Please report this issue.'
      );
    }

    mkdirSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE, { recursive: true });
    if (!existsSync(DAEMON_OUTPUT_LOG_FILE)) {
      writeFileSync(DAEMON_OUTPUT_LOG_FILE, '');
    }

    // Open the log handles into locals first. If the previous daemon's
    // socket close handler fires reset() while we're awaiting these opens,
    // it would null out this._out/this._err and the spawn below would hit
    // `Cannot read properties of null (reading 'fd')`.
    const [out, err] = await Promise.all([
      open(DAEMON_OUTPUT_LOG_FILE, 'a'),
      open(DAEMON_OUTPUT_LOG_FILE, 'a'),
    ]);
    this._out = out;
    this._err = err;

    clientLogger.log(`[Client] Starting new daemon server in background`);

    const backgroundProcess = spawn(
      process.execPath,
      [join(__dirname, `../server/start.js`)],
      {
        cwd: workspaceRoot,
        stdio: ['ignore', out.fd, err.fd],
        detached: true,
        windowsHide: true,
        shell: false,
        env: getDaemonEnv(),
      }
    );
    // if this process is the process that spawned the daemon,
    // the daemon env is already up to date
    this.envReflectionSent = true;
    backgroundProcess.unref();

    /**
     * Ensure the server is actually available to connect to via IPC before resolving
     */
    const serverAvailable = await this.waitForServerToBeAvailable({
      ignoreVersionMismatch: true,
    });
    if (serverAvailable) {
      clientLogger.log(
        `[Client] Daemon server started, pid=${backgroundProcess.pid}`
      );
      return backgroundProcess.pid;
    } else {
      throw daemonProcessException(
        'Failed to start or connect to the Nx Daemon process.'
      );
    }
  }

  async stop(): Promise<void> {
    try {
      const pid = getDaemonProcessIdSync();
      if (pid) {
        process.kill(pid, 'SIGTERM');
      }
    } catch (err) {
      if ((err as any).code !== 'ESRCH') {
        output.error({
          title:
            err?.message ||
            'Something unexpected went wrong when stopping the daemon server',
        });
      }
    }

    removeSocketDir();
  }
}

export const daemonClient = new DaemonClient();

export function isDaemonEnabled() {
  return daemonClient.enabled();
}

function isDocker() {
  try {
    statSync('/.dockerenv');
    return true;
  } catch {
    try {
      return readFileSync('/proc/self/cgroup', 'utf8')?.includes('docker');
    } catch {}

    return false;
  }
}

function nxJsonIsNotPresent() {
  return !hasNxJson(workspaceRoot);
}

function daemonProcessException(message: string) {
  try {
    let log = readFileSync(DAEMON_OUTPUT_LOG_FILE).toString().split('\n');
    if (log.length > 20) {
      log = log.slice(log.length - 20);
    }
    const error = new Error(
      [
        message,
        '',
        'Messages from the log:',
        ...log,
        '\n',
        `More information: ${DAEMON_OUTPUT_LOG_FILE}`,
      ].join('\n')
    );
    (error as any).internalDaemonError = true;
    return error;
  } catch (e) {
    return new Error(message);
  }
}
