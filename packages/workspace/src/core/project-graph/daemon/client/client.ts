import { logger, normalizePath, ProjectGraph } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { spawn, spawnSync } from 'child_process';
import { ensureFileSync } from 'fs-extra';
import { join } from 'path';
import { dirSync } from 'tmp';
import {
  DaemonJson,
  readDaemonJsonCache,
  writeDaemonJsonCache,
} from '../cache';
import { connect } from 'net';
import { FULL_OS_SOCKET_PATH, killSocketOrPath } from '../socket-utils';
import { performance } from 'perf_hooks';
import { existsSync } from 'fs';

export async function startInBackground(): Promise<void> {
  /**
   * For now, while the daemon is an opt-in feature, we will log to stdout when
   * starting the server, as well as providing a reference to where any subsequent
   * log files can be found.
   */
  const tmpDirPrefix = `nx-daemon--${normalizePath(appRootPath).replace(
    // Replace the occurrences of / in the unix-style normalized path with a -
    new RegExp(escapeRegExp('/'), 'g'),
    '-'
  )}`;
  const serverLogOutputDir = dirSync({
    prefix: tmpDirPrefix,
  }).name;
  const serverLogOutputFile = join(serverLogOutputDir, 'nx-daemon.log');
  ensureFileSync(serverLogOutputFile);

  // Clean up any existing orphaned background process before creating a new one
  const cachedDaemonJson = await readDaemonJsonCache();
  if (cachedDaemonJson && cachedDaemonJson.backgroundProcessId) {
    try {
      process.kill(cachedDaemonJson.backgroundProcessId);
    } catch (e) {}
  }

  logger.info(`NX Daemon Server - Starting in a background process...`);
  logger.log(
    `  Logs from the Daemon process can be found here: ${serverLogOutputFile}\n`
  );

  try {
    const backgroundProcess = spawn(
      process.execPath,
      ['../server/start.js', serverLogOutputFile],
      {
        cwd: __dirname,
        stdio: 'ignore',
        detached: true,
      }
    );
    backgroundProcess.unref();

    // Persist metadata about the background process so that it can be cleaned up later if needed
    const daemonJson: DaemonJson = {
      backgroundProcessId: backgroundProcess.pid,
      serverLogOutputFile: serverLogOutputFile,
    };
    await writeDaemonJsonCache(daemonJson);

    /**
     * Ensure the server is actually available to connect to via IPC before resolving
     */
    return new Promise((resolve) => {
      const id = setInterval(async () => {
        if (await isServerAvailable()) {
          clearInterval(id);
          resolve();
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
  logger.info(`NX Daemon Server - Stopping...`);

  spawnSync(process.execPath, ['../server/stop.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
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
  try {
    const socket = connect(FULL_OS_SOCKET_PATH);
    return new Promise((resolve) => {
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        resolve(false);
      });
    });
  } catch {
    return Promise.resolve(false);
  }
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
      logger.error(`NX Daemon Client - ${errorMessage || err}`);
      return reject(new Error(errorMessage) || err);
    });

    /**
     * Immediately after connecting to the server we send it the known project graph creation
     * request payload. See the notes above createServer() for more context as to why we explicitly
     * request the graph from the client like this.
     */
    socket.on('connect', () => {
      socket.write('REQUEST_PROJECT_GRAPH_PAYLOAD');

      let serializedProjectGraph = '';
      socket.on('data', (data) => {
        serializedProjectGraph += data.toString();
      });

      socket.on('end', () => {
        try {
          performance.mark('json-parse-start');
          const projectGraph = JSON.parse(
            serializedProjectGraph
          ) as ProjectGraph;
          performance.mark('json-parse-end');
          performance.measure(
            'deserialize graph on the client',
            'json-parse-start',
            'json-parse-end'
          );
          logger.info('NX Daemon Client - Resolved ProjectGraph');
          performance.measure(
            'total for getProjectGraphFromServer()',
            'getProjectGraphFromServer-start',
            'json-parse-end'
          );
          return resolve(projectGraph);
        } catch {
          logger.error(
            'NX Daemon Client - Error: Could not deserialize the ProjectGraph'
          );
          return reject(new Error('Could not deserialize the ProjectGraph'));
        }
      });
    });
  });
}
