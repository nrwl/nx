import { workspaceRoot } from '../../utils/workspace-root';
import { ChildProcess, spawn } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { FileHandle, open } from 'fs/promises';
import { connect } from 'net';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { output } from '../../utils/output';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  DAEMON_OUTPUT_LOG_FILE,
  isDaemonDisabled,
  removeSocketDir,
} from '../tmp-dir';
import { FileData, ProjectGraph } from '../../config/project-graph';
import { isCI } from '../../utils/is-ci';
import { hasNxJson, NxJsonConfiguration } from '../../config/nx-json';
import { readNxJson } from '../../config/configuration';
import { PromisedBasedQueue } from '../../utils/promised-based-queue';
import {
  DaemonSocketMessenger,
  Message,
  VersionMismatchError,
} from './daemon-socket-messenger';
import { clientLogger } from '../logger';
import { getDaemonProcessIdSync, readDaemonProcessJsonCache } from '../cache';
import { isNxVersionMismatch } from '../is-nx-version-mismatch';
import { Hash } from '../../hasher/task-hasher';
import { Task, TaskGraph } from '../../config/task-graph';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration-utils';
import {
  DaemonProjectGraphError,
  ProjectGraphError,
} from '../../project-graph/error-types';
import { IS_WASM, NxWorkspaceFiles, TaskRun, TaskTarget } from '../../native';
import {
  HandleGlobMessage,
  HandleMultiGlobMessage,
} from '../message-types/glob';
import {
  GET_NX_WORKSPACE_FILES,
  HandleNxWorkspaceFilesMessage,
} from '../message-types/get-nx-workspace-files';
import {
  GET_CONTEXT_FILE_DATA,
  HandleContextFileDataMessage,
} from '../message-types/get-context-file-data';
import {
  GET_FILES_IN_DIRECTORY,
  HandleGetFilesInDirectoryMessage,
} from '../message-types/get-files-in-directory';
import {
  HandleHashGlobMessage,
  HandleHashMultiGlobMessage,
  HASH_GLOB,
  HASH_MULTI_GLOB,
} from '../message-types/hash-glob';
import {
  GET_ESTIMATED_TASK_TIMINGS,
  GET_FLAKY_TASKS,
  HandleGetEstimatedTaskTimings,
  HandleGetFlakyTasks,
  HandleRecordTaskRunsMessage,
  RECORD_TASK_RUNS,
} from '../message-types/task-history';
import {
  GET_SYNC_GENERATOR_CHANGES,
  type HandleGetSyncGeneratorChangesMessage,
} from '../message-types/get-sync-generator-changes';
import type {
  FlushSyncGeneratorChangesResult,
  SyncGeneratorRunResult,
} from '../../utils/sync-generators';
import {
  GET_REGISTERED_SYNC_GENERATORS,
  type HandleGetRegisteredSyncGeneratorsMessage,
} from '../message-types/get-registered-sync-generators';
import {
  type HandleUpdateWorkspaceContextMessage,
  UPDATE_WORKSPACE_CONTEXT,
} from '../message-types/update-workspace-context';
import {
  FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
  type HandleFlushSyncGeneratorChangesToDiskMessage,
} from '../message-types/flush-sync-generator-changes-to-disk';
import { DelayedSpinner } from '../../utils/delayed-spinner';
import {
  PostTasksExecutionContext,
  PreTasksExecutionContext,
} from '../../project-graph/plugins/public-api';
import {
  HandlePostTasksExecutionMessage,
  HandlePreTasksExecutionMessage,
  POST_TASKS_EXECUTION,
  PRE_TASKS_EXECUTION,
} from '../message-types/run-tasks-execution-hooks';
import { REGISTER_PROJECT_GRAPH_LISTENER } from '../message-types/register-project-graph-listener';
import {
  GET_NX_CONSOLE_STATUS,
  type HandleGetNxConsoleStatusMessage,
  type HandleSetNxConsolePreferenceAndInstallMessage,
  type NxConsoleStatusResponse,
  SET_NX_CONSOLE_PREFERENCE_AND_INSTALL,
  type SetNxConsolePreferenceAndInstallResponse,
} from '../message-types/nx-console';
import { deserialize } from 'node:v8';
import { isJsonMessage } from '../../utils/consume-messages-from-socket';
import { preventRecursionInGraphConstruction } from '../../project-graph/project-graph';

const DAEMON_ENV_SETTINGS = {
  NX_PROJECT_GLOB_CACHE: 'false',
  NX_CACHE_PROJECTS_CONFIG: 'false',
  NX_VERBOSE_LOGGING: 'true',
  NX_PERF_LOGGING: 'true',
  NX_NATIVE_LOGGING: 'nx=debug',
};

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
      includeDependentProjects?: boolean;
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
        ((isCI() || isDocker()) && env !== 'true') ||
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

  private parseMessage(message: string): any {
    return isJsonMessage(message)
      ? JSON.parse(message)
      : deserialize(Buffer.from(message, 'binary'));
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
    ).scheduleMessageUpdate(
      'Calculating the project graph on the Nx Daemon is taking longer than expected. Re-run with NX_DAEMON=false to see more details.',
      { ciDelay: 60_000, delay: 30_000 }
    );
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
    }
  }

  async getAllFileData(): Promise<FileData[]> {
    return await this.sendToDaemonViaQueue({ type: 'REQUEST_FILE_DATA' });
  }

  hashTasks(
    runnerOptions: any,
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd: string
  ): Promise<Hash[]> {
    return this.sendToDaemonViaQueue({
      type: 'HASH_TASKS',
      runnerOptions,
      env:
        process.env.NX_USE_V8_SERIALIZER !== 'false'
          ? structuredClone(process.env)
          : env,
      tasks,
      taskGraph,
      cwd,
    });
  }

  async registerFileWatcher(
    config: {
      watchProjects: string[] | 'all';
      includeGlobalWorkspaceFiles?: boolean;
      includeDependentProjects?: boolean;
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
            const parsedMessage = this.parseMessage(message);
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
            const parsedMessage = this.parseMessage(message);
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
            const parsedMessage = this.parseMessage(message);
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
            const parsedMessage = this.parseMessage(message);
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
        // This method is sometimes passed data that cannot be serialized with v8
        // so we force JSON serialization here
      },
      'json'
    );
  }

  recordOutputsHash(outputs: string[], hash: string): Promise<any> {
    return this.sendToDaemonViaQueue({
      type: 'RECORD_OUTPUTS_HASH',
      data: {
        outputs,
        hash,
      },
    });
  }

  outputsHashesMatch(outputs: string[], hash: string): Promise<any> {
    return this.sendToDaemonViaQueue({
      type: 'OUTPUTS_HASHES_MATCH',
      data: {
        outputs,
        hash,
      },
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

  private async sendToDaemonViaQueue(
    messageToDaemon: Message,
    force?: 'v8' | 'json'
  ): Promise<any> {
    return this.queue.sendToQueue(() =>
      this.sendMessageToDaemon(messageToDaemon, force)
    );
  }

  private setUpConnection() {
    const socketPath = this.getSocketPath();

    this.socketMessenger = new DaemonSocketMessenger(
      connect(socketPath)
    ).listen(
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
        // Decrement the queue counter that was incremented when the error occurred
        this.queue.decrementQueueCounter();
        // Retry the message through the normal queue
        const msg = this.currentMessage;
        const res = this.currentResolve;
        const rej = this.currentReject;
        this.sendToDaemonViaQueue(msg).then(res, rej);
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
    let attempts = 0;

    clientLogger.log(
      `[Client] Waiting for server (max: ${WAIT_FOR_SERVER_CONFIG.maxAttempts} attempts, ${WAIT_FOR_SERVER_CONFIG.delayMs}ms interval)`
    );

    while (attempts < WAIT_FOR_SERVER_CONFIG.maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, WAIT_FOR_SERVER_CONFIG.delayMs)
      );
      attempts++;

      try {
        if (await this.isServerAvailable()) {
          clientLogger.log(
            `[Client] Server available after ${attempts} attempts`
          );
          return true;
        }
      } catch (err) {
        if (err instanceof VersionMismatchError) {
          if (!options.ignoreVersionMismatch) {
            throw err;
          }
          // Keep waiting - old cache file may exist
        } else {
          throw err;
        }
      }
    }

    clientLogger.log(
      `[Client] Server not available after ${WAIT_FOR_SERVER_CONFIG.maxAttempts} attempts`
    );
    return false;
  }

  private async sendMessageToDaemon(
    message: Message,
    force?: 'v8' | 'json'
  ): Promise<any> {
    await this.startDaemonIfNecessary();
    // An open promise isn't enough to keep the event loop
    // alive, so we set a timeout here and clear it when we hear
    // back
    const keepAlive = setTimeout(() => {}, 10 * 60 * 1000);
    return new Promise((resolve, reject) => {
      performance.mark('sendMessageToDaemon-start');

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
      const { getProcessMetricsService } = await import(
        '../../tasks-runner/process-metrics-service.js'
      );
      getProcessMetricsService().registerDaemonProcess(daemonPid);
    } catch {
      // don't error, this is a secondary concern that should not break task execution
    }
  }

  private handleMessage(serializedResult: string) {
    try {
      performance.mark('result-parse-start-' + this.currentMessage.type);
      const parsedResult = isJsonMessage(serializedResult)
        ? JSON.parse(serializedResult)
        : deserialize(Buffer.from(serializedResult, 'binary'));
      performance.mark('result-parse-end-' + this.currentMessage.type);
      performance.measure(
        'deserialize daemon response - ' + this.currentMessage.type,
        'result-parse-start-' + this.currentMessage.type,
        'result-parse-end-' + this.currentMessage.type
      );
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

    this._out = await open(DAEMON_OUTPUT_LOG_FILE, 'a');
    this._err = await open(DAEMON_OUTPUT_LOG_FILE, 'a');

    clientLogger.log(`[Client] Starting new daemon server in background`);

    const backgroundProcess = spawn(
      process.execPath,
      [join(__dirname, `../server/start.js`)],
      {
        cwd: workspaceRoot,
        stdio: ['ignore', this._out.fd, this._err.fd],
        detached: true,
        windowsHide: false,
        shell: false,
        env: {
          ...process.env,
          ...DAEMON_ENV_SETTINGS,
        },
      }
    );
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
