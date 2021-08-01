import { logger, ProjectGraph } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { appendFileSync, statSync, unlinkSync } from 'fs';
import { connect, createServer, Server } from 'net';
import { platform } from 'os';
import { join, resolve } from 'path';
import { createProjectGraph } from '../project-graph';

/**
 * For IPC with with the daemon server we use unix sockets or windows pipes, depending on the user's operating system.
 * Further notes on the cross-platform concerns are covered below.
 *
 * Unix:
 *
 * - The path is a filesystem pathname. It gets truncated to an OS-dependent length of sizeof(sockaddr_un.sun_path) - 1.
 * Typical values are 107 bytes on Linux and 103 bytes on macOS.
 * - A Unix domain socket will be visible in the filesystem and will persist until unlinked
 *
 * Windows:
 *
 * - The local domain is implemented using a named pipe. The path must refer to an entry in \\?\pipe\ or \\.\pipe\.
 * - Unlike Unix domain sockets, Windows will close and remove the pipe when the owning process exits.
 *
 * We create the socket/pipe based on a path within the current workspace so that we maintain one unique daemon per
 * workspace to ensure that subtle differences between Nx workspaces cannot cause issues.
 */
const workspaceSocketPath = join(appRootPath, './nx-daemon.sock');
const isWindows = platform() === 'win32';
const fullOSSocketPath = isWindows
  ? '\\\\.\\pipe\\nx\\' + resolve(workspaceSocketPath)
  : resolve(workspaceSocketPath);

/**
 * We have two different use-cases for the daemon server:
 * 1) Running in a background process so that the daemon is purely an implmentation detail.
 * 2) Running in the main process in order to aid with development/debugging.
 *
 * For (1) we do not want to log things from the daemon server to stdout/stderr, so we instead write to a file.
 *
 * This file location will be set by the `./exec/index.ts` utilities when starting the server so that we can
 * provide feedback to the user as to its location via stdout on the parent process and still not cause the child
 * process to be "undetachable".
 *
 * For (2) we simply log to stdout.
 */
let _serverLogOutputFile: string | undefined;
function log(...s: string[]) {
  /**
   * If _serverLogOutputFile has not be set when starting the server, it means we are
   * running it in the current process and we should log to stdout.
   */
  if (!_serverLogOutputFile) {
    console.log(...s);
    return;
  }
  appendFileSync(_serverLogOutputFile, `${s.join(' ')}\n`);
}

/**
 * For now we just invoke the existing `createProjectGraph()` utility and return the project
 * graph upon connection to the server
 */
const server = createServer((socket) => {
  log('NX Daemon Server - Connection Received');

  const projectGraph = createProjectGraph(
    undefined,
    undefined,
    undefined,
    '4.0'
  );
  log('NX Daemon Server - Project Graph Created');

  const serializedProjectGraph = JSON.stringify(projectGraph);

  socket.write(serializedProjectGraph, () => {
    log('NX Daemon Server - Closed Connection to Client');
    /**
     * Close the connection once all data has been written to the socket so that the client
     * knows when to read it.
     */
    socket.end();
  });
});

interface StartServerOptions {
  serverLogOutputFile?: string;
}

export async function startServer({
  serverLogOutputFile,
}: StartServerOptions): Promise<Server> {
  _serverLogOutputFile = serverLogOutputFile;

  // See notes above on OS differences regarding clean up of existings connections.
  if (!isWindows) {
    killSocketOrPath();
  }
  return new Promise((resolve) => {
    server.listen(fullOSSocketPath, () => {
      log(`NX Daemon Server - Started`);
      return resolve(server);
    });
  });
}

export async function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        /**
         * If the server is running in a detached background process then server.close()
         * will throw this error even if server is actually alive. We therefore only reject
         * in case of any other unexpected errors.
         */
        if (!err.message.startsWith('Server is not running')) {
          return reject(err);
        }
      }

      killSocketOrPath();
      /**
       * The distinction regarding background process or not is not relevant for stopping the server,
       * always pretty print the message to stdout.
       */
      logger.info('NX Daemon Server - Stopped');
      return resolve();
    });
  });
}

export function killSocketOrPath(): void {
  try {
    unlinkSync(fullOSSocketPath);
  } catch {}
}

export function isServerAvailable(): boolean {
  try {
    statSync(fullOSSocketPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Establishes a client connection to the daemon server for use in project graph
 * creation utilities.
 *
 * All logs are performed by the devkit logger because this logic does not
 * run "on the server" per se and therefore does not write to its log output.
 */
export async function getProjectGraphFromServer(): Promise<ProjectGraph> {
  return new Promise((resolve, reject) => {
    const socket = connect(fullOSSocketPath);

    socket.on('error', (err) => {
      let errorMessage: string | undefined;
      if (err.message.startsWith('connect ENOENT')) {
        errorMessage = 'Error: The Daemon Server is not running';
      }
      logger.error(`NX Daemon Client - ${errorMessage || err}`);
      return reject(new Error(errorMessage) || err);
    });

    let serializedProjectGraph = '';
    socket.on('data', (data) => {
      serializedProjectGraph += data.toString();
    });

    socket.on('end', () => {
      try {
        const projectGraph = JSON.parse(serializedProjectGraph) as ProjectGraph;
        logger.info('NX Daemon Client - Resolved ProjectGraph');
        return resolve(projectGraph);
      } catch {
        logger.error(
          'NX Daemon Client - Error: Could not deserialize the ProjectGraph'
        );
        return reject();
      }
    });
  });
}
