import { logger, ProjectGraph } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { appendFileSync, existsSync, statSync, unlinkSync } from 'fs';
import { connect, createServer, Server } from 'net';
import { platform } from 'os';
import { join, resolve } from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { defaultFileHasher } from '../../hasher/file-hasher';
import { gitRevParseHead } from '../../hasher/git-hasher';
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
 * We have two different use-cases for the "daemon" server:
 * 1) Running in a background process so that the daemon is purely an implementation detail.
 * 2) Running in the main process in order to aid with development/debugging (technically, of course, in this case
 * it isn't actually a daemon server at all, but for simplicity we stick with the same general name as its primary
 * reason for existence is to be run in a background process).
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
function serverLog(...s) {
  /**
   * If _serverLogOutputFile has not be set when starting the server, it means we are
   * running it in the current process and we should log to stdout.
   */
  if (!_serverLogOutputFile) {
    console.log(formatLogMessage(`${s.join(' ')}`));
    return;
  }
  appendFileSync(_serverLogOutputFile, formatLogMessage(`${s.join(' ')}\n`));
}

function formatLogMessage(message) {
  return `[NX Daemon Server] - ${new Date().toISOString()} - ${message}`;
}

/**
 * We cache the latest known HEAD value on the server so that we can potentially skip
 * some work initializing file hashes. If the HEAD value has not changed since we last
 * initialized the hashes, then we can move straight on to hashing uncommitted changes.
 */
let cachedGitHead: string | undefined;

/**
 * For now we just invoke the existing `createProjectGraph()` utility and return the project
 * graph upon connection to the server
 */
let performanceObserver: PerformanceObserver | undefined;
const server = createServer((socket) => {
  if (!performanceObserver) {
    performanceObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      // Slight indentation to improve readability of the overall log file
      serverLog(`  Time taken for '${entry.name}'`, `${entry.duration}ms`);
    });
  }
  performanceObserver.observe({ entryTypes: ['measure'], buffered: false });

  performance.mark('server-connection');
  serverLog('Connection Received');

  const currentGitHead = gitRevParseHead(appRootPath);
  if (currentGitHead === cachedGitHead) {
    defaultFileHasher.incrementalUpdate();
  } else {
    defaultFileHasher.init();
    cachedGitHead = currentGitHead;
  }

  const projectGraph = createProjectGraph(
    undefined,
    undefined,
    undefined,
    '4.0'
  );
  performance.mark('project-graph-created');
  performance.measure(
    'createProjectGraph() total',
    'server-connection',
    'project-graph-created'
  );

  const serializedProjectGraph = JSON.stringify(projectGraph);
  socket.write(serializedProjectGraph, () => {
    serverLog('Closed Connection to Client');
    /**
     * Close the connection once all data has been written to the socket so that the client
     * knows when to read it.
     */
    socket.end();
    performance.mark('serialized-project-graph-written-to-client');
    performance.measure(
      'serialize and write project graph to client',
      'project-graph-created',
      'serialized-project-graph-written-to-client'
    );
    performance.measure(
      'server response total',
      'server-connection',
      'serialized-project-graph-written-to-client'
    );
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
      serverLog(`Started`);
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
      if (err.message.startsWith('connect ECONNREFUSED')) {
        // If somehow the file descriptor had not been released during a previous shut down.
        if (existsSync(fullOSSocketPath)) {
          errorMessage = `Error: A server instance had not been fully shut down. Please try running the command again.`;
          killSocketOrPath();
        }
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
