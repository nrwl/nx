import { logger, ProjectGraph } from '@nrwl/devkit';
import { ChildProcess, spawn, spawnSync } from 'child_process';
import { existsSync, openSync } from 'fs';
import { connect } from 'net';
import { performance } from 'perf_hooks';
import {
  safelyCleanUpExistingProcess,
  writeDaemonJsonProcessCache,
} from '../cache';
import {
  deserializeResult,
  FULL_OS_SOCKET_PATH,
  killSocketOrPath,
} from '../socket-utils';
import { DAEMON_OUTPUT_LOG_FILE } from '../tmp-dir';

export async function startInBackground(): Promise<ChildProcess['pid']> {
  await safelyCleanUpExistingProcess();

  try {
    const out = openSync(DAEMON_OUTPUT_LOG_FILE, 'a');
    const err = openSync(DAEMON_OUTPUT_LOG_FILE, 'a');
    const backgroundProcess = spawn(process.execPath, ['../server/start.js'], {
      cwd: __dirname,
      stdio: ['ignore', out, err],
      detached: true,
      windowsHide: true,
      shell: false,
    });
    backgroundProcess.unref();

    // Persist metadata about the background process so that it can be cleaned up later if needed
    await writeDaemonJsonProcessCache({
      processId: backgroundProcess.pid,
    });

    /**
     * Ensure the server is actually available to connect to via IPC before resolving
     */
    return new Promise((resolve) => {
      const id = setInterval(async () => {
        if (await isServerAvailable()) {
          clearInterval(id);
          resolve(backgroundProcess.pid);
        }
      }, 500);
    });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

export function startInCurrentProcess(): void {
  logger.info(`NX Daemon Server - Starting in the current process...`);

  spawnSync(process.execPath, ['../server/start.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });
}

export function stop(): void {
  spawnSync(process.execPath, ['../server/stop.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  logger.info('NX Daemon Server - Stopped');
}

/**
 * As noted in the comments above the createServer() call, in order to reliably (meaning it works
 * cross-platform) check whether or not the server is availabe to request a project graph from we
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
      let errorMessage: string | undefined;
      if (err.message.startsWith('connect ENOENT')) {
        errorMessage = 'Error: The Daemon Server is not running';
      }
      if (err.message.startsWith('connect ECONNREFUSED')) {
        // If somehow the file descriptor had not been released during a previous shut down.
        if (existsSync(FULL_OS_SOCKET_PATH)) {
          errorMessage = `Error: A server instance had not been fully shut down. Please try running the command again.`;
          killSocketOrPath();
        }
      }
      return reject(new Error(errorMessage) || err);
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
          const projectGraphResult = deserializeResult(
            serializedProjectGraphResult
          );
          performance.mark('json-parse-end');
          performance.measure(
            'deserialize graph result on the client',
            'json-parse-start',
            'json-parse-end'
          );

          if (projectGraphResult.error) {
            return reject(projectGraphResult.error);
          }

          performance.measure(
            'total for getProjectGraphFromServer()',
            'getProjectGraphFromServer-start',
            'json-parse-end'
          );
          return resolve(projectGraphResult.projectGraph);
        } catch (e) {
          return reject(
            new Error(`Could not deserialize the ProjectGraph.\n${e.message}`)
          );
        }
      });
    });
  });
}
