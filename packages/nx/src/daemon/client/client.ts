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
import { getFullOsSocketPath, killSocketOrPath } from '../socket-utils';
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
import { DaemonSocketMessenger, Message } from './daemon-socket-messenger';
import { waitForDaemonToExitAndCleanupProcessJson } from '../cache';
import { Hash } from '../../hasher/task-hasher';
import { Task, TaskGraph } from '../../config/task-graph';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration-utils';
import {
  DaemonProjectGraphError,
  ProjectGraphError,
} from '../../project-graph/error-types';
import { IS_WASM, NxWorkspaceFiles, TaskRun, TaskTarget } from '../../native';
import { HandleGlobMessage } from '../message-types/glob';
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
import { HASH_GLOB, HandleHashGlobMessage } from '../message-types/hash-glob';
import {
  GET_ESTIMATED_TASK_TIMINGS,
  GET_FLAKY_TASKS,
  HandleGetEstimatedTaskTimings,
  HandleGetFlakyTasks,
  HandleRecordTaskRunsMessage,
  RECORD_TASK_RUNS,
} from '../message-types/task-history';
import { FORCE_SHUTDOWN } from '../message-types/force-shutdown';
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
  UPDATE_WORKSPACE_CONTEXT,
  type HandleUpdateWorkspaceContextMessage,
} from '../message-types/update-workspace-context';
import {
  FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
  type HandleFlushSyncGeneratorChangesToDiskMessage,
} from '../message-types/flush-sync-generator-changes-to-disk';
import { PendingPromise, registerPendingPromise } from '../../utils/messaging';
import {
  HandleRecordOutputsHashMessage,
  RECORD_OUTPUTS_HASH,
} from '../message-types/record-outputs-hash';

const DAEMON_ENV_SETTINGS = {
  NX_PROJECT_GLOB_CACHE: 'false',
  NX_CACHE_PROJECTS_CONFIG: 'false',
};

const DAEMON_TIMEOUT_HINT_TEXT =
  'As a last resort, you can set NX_DAEMON_NO_TIMEOUTS=true to bypass this timeout.';

const MINUTES = 15;

const MAX_MESSAGE_WAIT =
  process.env.NX_DAEMON_NO_TIMEOUTS === 'true'
    ? // Registering a timeout prevents the process from exiting
      // if the call to a plugin happens to be the only thing
      // keeping the process alive. As such, even if timeouts are disabled
      // we need to register one. 2147483647 is the max timeout
      // that Node.js allows, and is equivalent to 24.8 days....
      // This does mean that the NX_PLUGIN_NO_TIMEOUTS env var
      // would still timeout after 24.8 days, but that seems
      // like a reasonable compromise.
      2147483647
    : 1000 * 60 * MINUTES; // 10 minutes

const getTimeoutErrorMessage = (messageType: string) => () =>
  `The daemon process has not responded to the ${messageType} message within ${MINUTES} minutes. ${DAEMON_TIMEOUT_HINT_TEXT}`;

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

  private pendingPromises: Map<string, PendingPromise> = new Map();
  private pendingMessages: Map<string, Message> = new Map();

  private currentMessage;
  private currentResolve;
  private currentReject;

  private _enabled: boolean | undefined;
  private _daemonStatus: DaemonStatus = DaemonStatus.DISCONNECTED;
  private _waitForDaemonReady: Promise<void> | null = null;
  private _daemonReady: () => void | null = null;
  private _out: FileHandle = null;
  private _err: FileHandle = null;
  private txId: number = 0;

  getNextTxId(type: string) {
    return `${process.pid}:${type}:${this.txId++}`;
  }

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
      if (
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
    this.pendingPromises.clear();
    this._enabled = undefined;

    this._out?.close();
    this._err?.close();
    this._out = null;
    this._err = null;

    this._daemonStatus = DaemonStatus.DISCONNECTED;
    this._waitForDaemonReady = new Promise<void>(
      (resolve) => (this._daemonReady = resolve)
    );
  }

  private sendMessageToDaemonViaTx<
    T extends { type: string } = { type: string }
  >(message: T, socket: DaemonSocketMessenger) {
    const tx = this.getNextTxId(message.type);
    this.pendingMessages.set(tx, message);
    return registerPendingPromise(
      tx,
      this.pendingPromises,
      () => {
        this.sendMessageToDaemon({ ...message, tx }, socket);
      },
      getTimeoutErrorMessage(message.type),
      MAX_MESSAGE_WAIT
    );
  }

  private async sendToDaemonViaQueue(
    messageToDaemon: Message,
    socket: DaemonSocketMessenger
  ): Promise<any> {
    return this.queue.sendToQueue(() =>
      this.sendMessageToDaemon(messageToDaemon, socket)
    );
  }

  private async sendMessageToDaemonViaQueueOrTx<T extends Message>(
    message: T,
    socket = this.socketMessenger
  ) {
    if (process.env.NX_DAEMON_USE_QUEUE === 'true') {
      return this.sendToDaemonViaQueue(message, socket);
    } else {
      return this.sendMessageToDaemonViaTx(message, socket);
    }
  }

  async requestShutdown(): Promise<void> {
    return this.sendMessageToDaemonViaQueueOrTx({ type: 'REQUEST_SHUTDOWN' });
  }

  async getProjectGraphAndSourceMaps(): Promise<{
    projectGraph: ProjectGraph;
    sourceMaps: ConfigurationSourceMaps;
  }> {
    return this.sendMessageToDaemonViaQueueOrTx({
      type: 'REQUEST_PROJECT_GRAPH',
    })
      .then((response) => {
        return {
          projectGraph: response.projectGraph,
          sourceMaps: response.sourceMaps,
        };
      })
      .catch((e) => {
        if (e.name === DaemonProjectGraphError.name) {
          throw ProjectGraphError.fromDaemonProjectGraphError(e);
        } else {
          throw e;
        }
      });
  }

  async getAllFileData(): Promise<FileData[]> {
    return this.sendMessageToDaemonViaQueueOrTx({
      type: 'REQUEST_ALL_FILE_DATA',
    });
  }

  hashTasks(
    runnerOptions: any,
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<Hash[]> {
    return this.sendMessageToDaemonViaQueueOrTx({
      type: 'HASH_TASKS',
      runnerOptions,
      env,
      tasks,
      taskGraph,
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
      error: Error | null | 'closed',
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

    let messenger: DaemonSocketMessenger | undefined =
      new DaemonSocketMessenger(connect(getFullOsSocketPath())).listen(
        (message) => {
          try {
            const parsedMessage = JSON.parse(message);
            callback(null, parsedMessage);
          } catch (e) {
            callback(e, null);
          }
        },
        () => {
          callback('closed', null);
        },
        (err) => callback(err, null)
      );

    await this.sendMessageToDaemonViaQueueOrTx(
      {
        type: 'REGISTER_FILE_WATCHER',
        config,
      },
      messenger
    );

    return () => {
      messenger?.close();
    };
  }

  processInBackground(requirePath: string, data: any): Promise<any> {
    return this.sendMessageToDaemonViaQueueOrTx({
      type: 'PROCESS_IN_BACKGROUND',
      requirePath,
      data,
    });
  }

  recordOutputsHash(outputs: string[], hash: string): Promise<any> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleRecordOutputsHashMessage>(
      {
        type: RECORD_OUTPUTS_HASH,
        data: {
          outputs,
          hash,
        },
      }
    );
  }

  outputsHashesMatch(outputs: string[], hash: string): Promise<any> {
    return this.sendMessageToDaemonViaQueueOrTx({
      type: 'OUTPUTS_HASHES_MATCH',
      data: {
        outputs,
        hash,
      },
    });
  }

  glob(globs: string[], exclude?: string[]): Promise<string[]> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleGlobMessage>({
      type: 'GLOB',
      globs,
      exclude,
    });
  }

  getWorkspaceContextFileData(): Promise<FileData[]> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleContextFileDataMessage>({
      type: GET_CONTEXT_FILE_DATA,
    });
  }

  getWorkspaceFiles(
    projectRootMap: Record<string, string>
  ): Promise<NxWorkspaceFiles> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleNxWorkspaceFilesMessage>({
      type: GET_NX_WORKSPACE_FILES,
      projectRootMap,
    });
  }

  getFilesInDirectory(dir: string): Promise<string[]> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleGetFilesInDirectoryMessage>(
      {
        type: GET_FILES_IN_DIRECTORY,
        dir,
      }
    );
  }

  hashGlob(globs: string[], exclude?: string[]): Promise<string> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleHashGlobMessage>({
      type: HASH_GLOB,
      globs,
      exclude,
    });
  }

  getFlakyTasks(hashes: string[]): Promise<string[]> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleGetFlakyTasks>({
      type: GET_FLAKY_TASKS,
      hashes,
    });
  }

  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleGetEstimatedTaskTimings>({
      type: GET_ESTIMATED_TASK_TIMINGS,
      targets,
    });
  }

  recordTaskRuns(taskRuns: TaskRun[]): Promise<void> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleRecordTaskRunsMessage>({
      type: RECORD_TASK_RUNS,
      taskRuns,
    });
  }

  getSyncGeneratorChanges(
    generators: string[]
  ): Promise<SyncGeneratorRunResult[]> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleGetSyncGeneratorChangesMessage>(
      {
        type: GET_SYNC_GENERATOR_CHANGES,
        generators,
      }
    );
  }

  flushSyncGeneratorChangesToDisk(
    generators: string[]
  ): Promise<FlushSyncGeneratorChangesResult> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleFlushSyncGeneratorChangesToDiskMessage>(
      {
        type: FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK,
        generators,
      }
    );
  }

  getRegisteredSyncGenerators(): Promise<{
    globalGenerators: string[];
    taskGenerators: string[];
  }> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleGetRegisteredSyncGeneratorsMessage>(
      {
        type: GET_REGISTERED_SYNC_GENERATORS,
      }
    );
  }

  updateWorkspaceContext(
    createdFiles: string[],
    updatedFiles: string[],
    deletedFiles: string[]
  ): Promise<void> {
    return this.sendMessageToDaemonViaQueueOrTx<HandleUpdateWorkspaceContextMessage>(
      {
        type: UPDATE_WORKSPACE_CONTEXT,
        createdFiles,
        updatedFiles,
        deletedFiles,
      }
    );
  }

  async isServerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const socket = connect(getFullOsSocketPath(), () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => {
          resolve(false);
        });
      } catch (err) {
        resolve(false);
      }
    });
  }

  private rejectAllPendingPromises(err) {
    this.pendingPromises.forEach((pending) => {
      pending.rejector(err);
    });
    this.pendingPromises.clear();
  }

  private setUpConnection() {
    this.socketMessenger = new DaemonSocketMessenger(
      connect(getFullOsSocketPath())
    ).listen(
      (message) => this.handleMessage(message),
      () => {
        // it's ok for the daemon to terminate if the client doesn't wait on
        // any messages from the daemon
        if (this.pendingPromises.size === 0) {
          this.reset();
        } else {
          output.error({
            title: 'Daemon process terminated and closed the connection',
            bodyLines: [
              'Please rerun the command, which will restart the daemon.',
              `If you get this error again, check for any errors in the daemon process logs found in: ${DAEMON_OUTPUT_LOG_FILE}`,
            ],
          });
          this._daemonStatus = DaemonStatus.DISCONNECTED;
          this.pendingPromises.forEach((pending) =>
            pending.rejector?.(
              daemonProcessException(
                'Daemon process terminated and closed the connection'
              )
            )
          );
          process.exit(1);
        }
      },
      (err) => {
        if (!err.message) {
          return this.rejectAllPendingPromises(
            daemonProcessException(err.toString())
          );
        }

        // TODO: @AgentEnder - figure out how to handle this... Not sure this is
        // actually even being used.
        // if (err.message.startsWith('LOCK-FILES-CHANGED')) {
        //   // retry the current message
        //   // we cannot send it via the queue because we are in the middle of processing
        //   // a message from the queue
        //   return this.sendMessageToDaemon(this.currentMessage).then(
        //     this.currentResolve,
        //     this.currentReject
        //   );
        // }

        let error: any;
        if (err.message.startsWith('connect ENOENT')) {
          error = daemonProcessException('The Daemon Server is not running');
        } else if (err.message.startsWith('connect ECONNREFUSED')) {
          error = daemonProcessException(
            `A server instance had not been fully shut down. Please try running the command again.`
          );
          killSocketOrPath();
        } else if (err.message.startsWith('read ECONNRESET')) {
          error = daemonProcessException(
            `Unable to connect to the daemon process.`
          );
        } else {
          error = daemonProcessException(err.toString());
        }
        return this.rejectAllPendingPromises(error);
      }
    );
  }

  private async sendMessageToDaemon(
    message: Message,
    socket: DaemonSocketMessenger = this.socketMessenger
  ): Promise<any> {
    if (this._daemonStatus == DaemonStatus.DISCONNECTED) {
      this._daemonStatus = DaemonStatus.CONNECTING;

      if (!(await this.isServerAvailable())) {
        await this.startInBackground();
      }
      this.setUpConnection();
      this._daemonStatus = DaemonStatus.CONNECTED;
      this._daemonReady();
    } else if (this._daemonStatus == DaemonStatus.CONNECTING) {
      await this._waitForDaemonReady;
    }
    socket.sendMessage(message);
  }

  private handleMessage(serializedResult: string) {
    try {
      performance.mark('json-parse-start');
      const { response: parsedResult, tx } = JSON.parse(serializedResult);
      performance.mark('json-parse-end');
      performance.measure(
        'deserialize daemon response',
        'json-parse-start',
        'json-parse-end'
      );
      if (tx) {
        const pending = this.pendingPromises.get(tx);
        if (pending) {
          if (parsedResult.error) {
            pending.rejector(parsedResult.error);
          } else {
            pending.resolver(parsedResult);
          }
          this.pendingPromises.delete(tx);
        } else {
        }
      } else if (process.env.NX_DAEMON_USE_QUEUE === 'true') {
        if (parsedResult.error) {
          this.currentReject(parsedResult.error);
        } else {
          performance.measure(
            'total for sendMessageToDaemon()',
            'sendMessageToDaemon-start',
            'json-parse-end'
          );
          return this.currentResolve(parsedResult);
        }
      } else {
        output.error({
          title: `Received a response without a transaction ID: ${JSON.stringify(
            parsedResult
          )}`,
          bodyLines: [
            'This is likely a bug in Nx. Please report it.',
            'The response will be ignored.',
          ],
        });
      }
    } catch (e) {
      const endOfResponse =
        serializedResult.length > 300
          ? serializedResult.substring(serializedResult.length - 300)
          : serializedResult;
      this.pendingPromises.forEach((pending) => {
        pending.rejector(
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
      });
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
    let attempts = 0;
    return new Promise((resolve, reject) => {
      const id = setInterval(async () => {
        if (await this.isServerAvailable()) {
          clearInterval(id);
          resolve(backgroundProcess.pid);
        } else if (attempts > 6000) {
          // daemon fails to start, the process probably exited
          // we print the logs and exit the client
          reject(
            daemonProcessException(
              'Failed to start or connect to the Nx Daemon process.'
            )
          );
        } else {
          attempts++;
        }
      }, 10);
    });
  }

  async stop(): Promise<void> {
    return this.sendMessageToDaemonViaQueueOrTx({ type: 'FORCE_SHUTDOWN' })
      .catch((e) => {
        output.error({
          title:
            e?.message ||
            'Something unexpected went wrong when stopping the daemon server',
        });
      })
      .then(() => {
        removeSocketDir();
      });
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
