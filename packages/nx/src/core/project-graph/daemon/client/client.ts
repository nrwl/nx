import { workspaceRoot } from 'nx/src/utils/app-root';
import { ChildProcess, spawn, spawnSync } from 'child_process';
import { openSync, readFileSync } from 'fs';
import { ensureDirSync, ensureFileSync } from 'fs-extra';
import { connect } from 'net';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { output } from '../../../../utils/output';
import {
  safelyCleanUpExistingProcess,
  writeDaemonJsonProcessCache,
} from '../cache';
import { FULL_OS_SOCKET_PATH, killSocketOrPath } from '../socket-utils';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  DAEMON_OUTPUT_LOG_FILE,
} from '../tmp-dir';
import { ProjectGraph } from 'nx/src/shared/project-graph';

export async function startInBackground(): Promise<ChildProcess['pid']> {
  await safelyCleanUpExistingProcess();
  ensureDirSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
  ensureFileSync(DAEMON_OUTPUT_LOG_FILE);

  const out = openSync(DAEMON_OUTPUT_LOG_FILE, 'a');
  const err = openSync(DAEMON_OUTPUT_LOG_FILE, 'a');
  const backgroundProcess = spawn(
    process.execPath,
    [join(__dirname, '../server/start.js')],
    {
      cwd: workspaceRoot,
      stdio: ['ignore', out, err],
      detached: true,
      windowsHide: true,
      shell: false,
    }
  );
  backgroundProcess.unref();

  // Persist metadata about the background process so that it can be cleaned up later if needed
  await writeDaemonJsonProcessCache({
    processId: backgroundProcess.pid,
  });

  /**
   * Ensure the server is actually available to connect to via IPC before resolving
   */
  let attempts = 0;
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      if (await isServerAvailable()) {
        clearInterval(id);
        resolve(backgroundProcess.pid);
      } else if (attempts > 200) {
        // daemon fails to start, the process probably exited
        // we print the logs and exit the client
        reject(
          daemonProcessException('Failed to start the Nx Daemon process.')
        );
      } else {
        attempts++;
      }
    }, 10);
  });
}

function daemonProcessException(message: string) {
  try {
    let log = readFileSync(DAEMON_OUTPUT_LOG_FILE).toString().split('\n');
    if (log.length > 20) {
      log = log.slice(log.length - 20);
    }
    return new Error(
      [
        message,
        'Messages from the log:',
        ...log,
        '\n',
        `More information: ${DAEMON_OUTPUT_LOG_FILE}`,
      ].join('\n')
    );
  } catch (e) {
    return new Error(message);
  }
}

export function startInCurrentProcess(): void {
  output.log({
    title: `Daemon Server - Starting in the current process...`,
  });

  spawnSync(process.execPath, [join(__dirname, '../server/start.js')], {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
}

export function stop(): void {
  spawnSync(process.execPath, ['../server/stop.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  output.log({ title: 'Daemon Server - Stopped' });
}

/**
 * As noted in the comments above the createServer() call, in order to reliably (meaning it works
 * cross-platform) check whether the server is available to request a project graph from we
 * need to actually attempt connecting to it.
 *
 * Because of the behavior of named pipes on Windows, we cannot simply treat them as a file and
 * check for their existence on disk (unlike with Unix Sockets).
 */
export async function isServerAvailable(): Promise<boolean> {
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

/**
 * Establishes a client connection to the daemon server for use in project graph
 * creation utilities.
 *
 * All logs are performed by the devkit logger because this logic does not
 * run "on the server" per se and therefore does not write to its log output.
 *
 * TODO: Gracefully handle a server shutdown (for whatever reason) while a client
 * is connecting and querying it.
 */
export async function getProjectGraphFromServer(): Promise<ProjectGraph> {
  return new Promise((resolve, reject) => {
    performance.mark('getProjectGraphFromServer-start');
    const socket = connect(FULL_OS_SOCKET_PATH);

    socket.on('error', (err) => {
      if (!err.message) {
        return reject(err);
      }
      if (err.message.startsWith('LOCK-FILES-CHANGED')) {
        return getProjectGraphFromServer().then(resolve, reject);
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
      }
      return reject(error || err);
    });

    /**
     * Immediately after connecting to the server we send it the known project graph creation
     * request payload. See the notes above createServer() for more context as to why we explicitly
     * request the graph from the client like this.
     */
    socket.on('connect', () => {
      socket.write('REQUEST_PROJECT_GRAPH_PAYLOAD');

      let serializedProjectGraphResult = '';
      socket.on('data', (data) => {
        serializedProjectGraphResult += data.toString();
      });

      socket.on('end', () => {
        try {
          performance.mark('json-parse-start');
          const projectGraphResult = JSON.parse(serializedProjectGraphResult);
          performance.mark('json-parse-end');
          performance.measure(
            'deserialize graph result on the client',
            'json-parse-start',
            'json-parse-end'
          );
          if (projectGraphResult.error) {
            reject(projectGraphResult.error);
          } else {
            performance.measure(
              'total for getProjectGraphFromServer()',
              'getProjectGraphFromServer-start',
              'json-parse-end'
            );
            return resolve(projectGraphResult.projectGraph);
          }
        } catch (e) {
          const endOfGraph =
            serializedProjectGraphResult.length > 300
              ? serializedProjectGraphResult.substring(
                  serializedProjectGraphResult.length - 300
                )
              : serializedProjectGraphResult;
          reject(
            daemonProcessException(
              [
                'Could not deserialize project graph.',
                `Message: ${e.message}`,
                '\n',
                `Received:`,
                endOfGraph,
                '\n',
              ].join('\n')
            )
          );
        }
      });
    });
  });
}
