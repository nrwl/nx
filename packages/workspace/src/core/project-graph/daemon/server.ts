import { logger, ProjectGraph } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { appendFileSync, existsSync, statSync, unlinkSync } from 'fs';
import { connect, createServer, Server } from 'net';
import { platform } from 'os';
import { join, resolve } from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { defaultFileHasher } from '../../hasher/file-hasher';
import { gitRevParseHead } from '../../hasher/git-hasher';
import { defaultHashing } from '../../hasher/hashing-impl';
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
 * We cache the latest known HEAD value and an overall hash of the state of the untracked
 * and uncommitted files so that we can potentially skip some initialization work.
 */
let cachedGitHead: string | undefined;
let cachedUntrackedUncommittedState: string | undefined;

function hashAndCacheUntrackedUncommittedState(
  untrackedAndUncommittedFileHashes: Map<string, string>
): void {
  const fileHashesMapAsFlatArray = [].concat(
    ...Array.from(untrackedAndUncommittedFileHashes)
  );
  cachedUntrackedUncommittedState = defaultHashing.hashArray(
    fileHashesMapAsFlatArray
  );
}

/**
 * We cache the latest copy of the serialized project graph itself in memory so that in the
 * best case scenario we can skip all graph construction and serialization work entirely.
 */
let cachedSerializedProjectGraph: string | undefined;

function createAndSerializeProjectGraph(): string {
  performance.mark('create-project-graph-start');
  const projectGraph = createProjectGraph(
    undefined,
    undefined,
    undefined,
    '4.0'
  );
  performance.mark('create-project-graph-end');
  performance.measure(
    'total execution time for createProjectGraph()',
    'create-project-graph-start',
    'create-project-graph-end'
  );

  performance.mark('json-stringify-start');
  const serializedProjectGraph = JSON.stringify(projectGraph);
  performance.mark('json-stringify-end');
  performance.measure(
    'serialize graph',
    'json-stringify-start',
    'json-stringify-end'
  );

  return serializedProjectGraph;
}

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

  let serializedProjectGraph: string | undefined;

  /**
   * Cached HEAD has changed, we must perform full file-hashing initialization work and
   * recompute the project graph
   */
  if (currentGitHead !== cachedGitHead) {
    serverLog(
      ` [SERVER STATE]: Cached HEAD does not match current (${currentGitHead}), performing full file hash init and recomputing project graph...`
    );
    /**
     * Update the cached values for the HEAD and untracked and uncommitted state which was computed
     * as part of full init()
     */
    const untrackedAndUncommittedFileHashes = defaultFileHasher.init();
    hashAndCacheUntrackedUncommittedState(untrackedAndUncommittedFileHashes);
    cachedGitHead = currentGitHead;
    serializedProjectGraph = createAndSerializeProjectGraph();
  } else {
    /**
     * We know at this point that the cached HEAD has not changed but we must still always use git
     * to check for untracked and uncommitted changes (and we then create and cache a hash which
     * represents their overall state).
     *
     * We cannot ever skip this particular git operation, but we can compare its result to our
     * previously cached hash which represents the overall state for untracked and uncommitted changes
     * and then potentially skip project graph creation altogether if it is unchanged and we have an
     * existing cached graph.
     */
    const previousUntrackedUncommittedState = cachedUntrackedUncommittedState;
    const untrackedAndUncommittedFileHashes =
      defaultFileHasher.incrementalUpdate();
    hashAndCacheUntrackedUncommittedState(untrackedAndUncommittedFileHashes);

    /**
     * Skip project graph creation if the untracked and uncommitted state is unchanged and we have
     * a cached version of the graph available in memory.
     */
    if (
      previousUntrackedUncommittedState === cachedUntrackedUncommittedState &&
      cachedSerializedProjectGraph
    ) {
      serverLog(
        ` [SERVER STATE]: State unchanged since last request, resolving in-memory cached project graph...`
      );
      serializedProjectGraph = cachedSerializedProjectGraph;
    } else {
      serverLog(
        ` [SERVER STATE]: Hashed untracked/uncommitted file state changed (now ${cachedUntrackedUncommittedState}), recomputing project graph...`
      );
      serializedProjectGraph = createAndSerializeProjectGraph();
    }
  }

  /**
   * Cache the latest version of the project graph in memory so that we can potentially skip a lot
   * of expensive work on the next client request.
   *
   * For reference, on the very large test repo https://github.com/vsavkin/interstellar the project
   * graph nxdeps.json file is about 24MB, so memory utilization should not be a huge concern.
   */
  cachedSerializedProjectGraph = serializedProjectGraph;

  performance.mark('serialized-project-graph-ready');
  performance.measure(
    'total for creating and serializing project graph',
    'server-connection',
    'serialized-project-graph-ready'
  );

  socket.write(serializedProjectGraph, () => {
    performance.mark('serialized-project-graph-written-to-client');
    performance.measure(
      'write project graph to socket',
      'serialized-project-graph-ready',
      'serialized-project-graph-written-to-client'
    );
    /**
     * Close the connection once all data has been written to the socket so that the client
     * knows when to read it.
     */
    socket.end();
    serverLog('Closed Connection to Client');

    const bytesWritten = Buffer.byteLength(serializedProjectGraph, 'utf-8');
    performance.measure(
      `total for server response (${bytesWritten} bytes transferred)`,
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
