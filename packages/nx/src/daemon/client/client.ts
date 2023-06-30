import { workspaceRoot } from '../../utils/workspace-root';
import { ChildProcess, spawn } from 'child_process';
import { readFileSync, statSync } from 'fs';
import { FileHandle, open } from 'fs/promises';
import { ensureDirSync, ensureFileSync } from 'fs-extra';
import { connect } from 'net';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { output } from '../../utils/output';
import { FULL_OS_SOCKET_PATH, killSocketOrPath } from '../socket-utils';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  DAEMON_OUTPUT_LOG_FILE,
  isDaemonDisabled,
  removeSocketDir,
} from '../tmp-dir';
import { FileData, ProjectGraph } from '../../config/project-graph';
import { isCI } from '../../utils/is-ci';
import { NxJsonConfiguration } from '../../config/nx-json';
import { readNxJson } from '../../config/configuration';
import { PromisedBasedQueue } from '../../utils/promised-based-queue';
import { Workspaces } from '../../config/workspaces';
import { Message, SocketMessenger } from './socket-messenger';
import { safelyCleanUpExistingProcess } from '../cache';
import { Hash } from '../../hasher/task-hasher';
import { Task, TaskGraph } from '../../config/task-graph';

const DAEMON_ENV_SETTINGS = {
  ...process.env,
  NX_PROJECT_GLOB_CACHE: 'false',
  NX_CACHE_PROJECTS_CONFIG: 'false',
};

export type UnregisterCallback = () => void;
export type ChangedFile = {
  path: string;
  type: 'create' | 'update' | 'delete';
};

export class DaemonClient {
  constructor(private readonly nxJson: NxJsonConfiguration) {
    this.reset();
  }

  private queue: PromisedBasedQueue;
  private socketMessenger: SocketMessenger;

  private currentMessage;
  private currentResolve;
  private currentReject;

  private _enabled: boolean | undefined;
  private _connected: boolean;
  private _out: FileHandle = null;
  private _err: FileHandle = null;

  enabled() {
    if (this._enabled === undefined) {
      const useDaemonProcessOption =
        this.nxJson.tasksRunnerOptions?.['default']?.options?.useDaemonProcess;
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
      if (
        (isCI() && env !== 'true') ||
        isDocker() ||
        isDaemonDisabled() ||
        nxJsonIsNotPresent() ||
        (useDaemonProcessOption === undefined && env === 'false') ||
        (useDaemonProcessOption === true && env === 'false') ||
        (useDaemonProcessOption === false && env === undefined) ||
        (useDaemonProcessOption === false && env === 'false')
      ) {
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

    this._connected = false;
  }

  async requestShutdown(): Promise<void> {
    return this.sendToDaemonViaQueue({ type: 'REQUEST_SHUTDOWN' });
  }

  async getProjectGraph(): Promise<ProjectGraph> {
    return (await this.sendToDaemonViaQueue({ type: 'REQUEST_PROJECT_GRAPH' }))
      .projectGraph;
  }

  async getAllFileData(): Promise<FileData[]> {
    return await this.sendToDaemonViaQueue({ type: 'REQUEST_FILE_DATA' });
  }

  hashTasks(
    runnerOptions: any,
    tasks: Task[],
    taskGraph: TaskGraph
  ): Promise<Hash[]> {
    return this.sendToDaemonViaQueue({
      type: 'HASH_TASKS',
      runnerOptions,
      env: process.env,
      tasks,
      taskGraph,
    });
  }

  async registerFileWatcher(
    config: {
      watchProjects: string[] | 'all';
      includeGlobalWorkspaceFiles?: boolean;
      includeDependentProjects?: boolean;
    },
    callback: (
      error: Error | null | 'closed',
      data: {
        changedProjects: string[];
        changedFiles: ChangedFile[];
      } | null
    ) => void
  ): Promise<UnregisterCallback> {
    await this.getProjectGraph();
    const messenger = new SocketMessenger(connect(FULL_OS_SOCKET_PATH)).listen(
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

    await this.queue.sendToQueue(() =>
      messenger.sendMessage({ type: 'REGISTER_FILE_WATCHER', config })
    );

    return () => {
      messenger.close();
    };
  }

  processInBackground(requirePath: string, data: any): Promise<any> {
    return this.sendToDaemonViaQueue({
      type: 'PROCESS_IN_BACKGROUND',
      requirePath,
      data,
    });
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

  async isServerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const socket = connect(FULL_OS_SOCKET_PATH, () => {
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

  private async sendToDaemonViaQueue(messageToDaemon: Message): Promise<any> {
    return this.queue.sendToQueue(() =>
      this.sendMessageToDaemon(messageToDaemon)
    );
  }

  private setUpConnection() {
    this.socketMessenger = new SocketMessenger(
      connect(FULL_OS_SOCKET_PATH)
    ).listen(
      (message) => this.handleMessage(message),
      () => {
        // it's ok for the daemon to terminate if the client doesn't wait on
        // any messages from the daemon
        if (this.queue.isEmpty()) {
          this._connected = false;
        } else {
          output.error({
            title: 'Daemon process terminated and closed the connection',
            bodyLines: [
              'Please rerun the command, which will restart the daemon.',
              `If you get this error again, check for any errors in the daemon process logs found in: ${DAEMON_OUTPUT_LOG_FILE}`,
            ],
          });
          process.exit(1);
        }
      },
      (err) => {
        if (!err.message) {
          return this.currentReject(daemonProcessException(err.toString()));
        }

        if (err.message.startsWith('LOCK-FILES-CHANGED')) {
          // retry the current message
          // we cannot send it via the queue because we are in the middle of processing
          // a message from the queue
          return this.sendMessageToDaemon(this.currentMessage).then(
            this.currentResolve,
            this.currentReject
          );
        }

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
        return this.currentReject(error);
      }
    );
  }

  private async sendMessageToDaemon(message: Message): Promise<any> {
    if (!this._connected) {
      this._connected = true;
      if (!(await this.isServerAvailable())) {
        await this.startInBackground();
      }
      this.setUpConnection();
    }

    return new Promise((resolve, reject) => {
      performance.mark('sendMessageToDaemon-start');

      this.currentMessage = message;
      this.currentResolve = resolve;
      this.currentReject = reject;

      this.socketMessenger.sendMessage(message);
    });
  }

  private handleMessage(serializedResult: string) {
    try {
      performance.mark('json-parse-start');
      const parsedResult = JSON.parse(serializedResult);
      performance.mark('json-parse-end');
      performance.measure(
        'deserialize daemon response',
        'json-parse-start',
        'json-parse-end'
      );
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
    ensureDirSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    ensureFileSync(DAEMON_OUTPUT_LOG_FILE);

    this._out = await open(DAEMON_OUTPUT_LOG_FILE, 'a');
    this._err = await open(DAEMON_OUTPUT_LOG_FILE, 'a');

    if (this.nxJson.tasksRunnerOptions.default?.options?.useParcelWatcher) {
      DAEMON_ENV_SETTINGS['NX_NATIVE_WATCHER'] = 'false';
    } else {
      DAEMON_ENV_SETTINGS['NX_NATIVE_WATCHER'] = 'true';
    }

    const backgroundProcess = spawn(
      process.execPath,
      [join(__dirname, '../server/start.js')],
      {
        cwd: workspaceRoot,
        stdio: ['ignore', this._out.fd, this._err.fd],
        detached: true,
        windowsHide: true,
        shell: false,
        env: DAEMON_ENV_SETTINGS,
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
    try {
      await safelyCleanUpExistingProcess();
    } catch (err) {
      output.error({
        title:
          err?.message ||
          'Something unexpected went wrong when stopping the server',
      });
    }

    removeSocketDir();
  }
}

export const daemonClient = new DaemonClient(readNxJson());

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
  return !new Workspaces(workspaceRoot).hasNxJson();
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
