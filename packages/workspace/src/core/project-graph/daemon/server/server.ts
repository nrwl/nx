import { logger } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { appendFileSync } from 'fs';
import { createServer, Server } from 'net';
import { performance, PerformanceObserver } from 'perf_hooks';
import { defaultFileHasher } from '../../../hasher/file-hasher';
import {
  getGitHashForFiles,
  getUntrackedAndUncommittedFileHashes,
  gitRevParseHead,
} from '../../../hasher/git-hasher';
import { createProjectGraph } from '../../project-graph';
import {
  FULL_OS_SOCKET_PATH,
  isWindows,
  killSocketOrPath,
} from '../socket-utils';
import {
  convertChangeEventsToLogMessage,
  subscribeToWorkspaceChanges,
  SubscribeToWorkspaceChangesCallback,
  WatcherSubscription,
} from './watcher';

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
 * To improve the overall readibility of the logs, we categorize things by "trigger":
 *
 * - [REQUEST] meaning that the current set of actions were triggered by a client request to the server
 * - [WATCHER] meaning the the current set of actions were triggered by handling changes to the workspace files
 *
 * We keep those two "triggers" left aligned at the top level and then indent subsequent logs so that there is a
 * logical hierarchy/grouping.
 */
function requestLog(...s) {
  serverLog(`[REQUEST]: ${s.join(' ')}`);
}
function watcherLog(...s) {
  serverLog(`[WATCHER]: ${s.join(' ')}`);
}
function nestedLog(...s) {
  serverLog(`  ${s.join(' ')}`);
}

/**
 * We cache the latest known HEAD value so that we can potentially skip some initialization work.
 */
let cachedGitHead: string | undefined;

/**
 * We cache the latest copy of the serialized project graph itself in memory so that in the
 * best case scenario we can skip all graph construction and serialization work entirely.
 */
let cachedSerializedProjectGraph: string | undefined;

async function createAndSerializeProjectGraph(): Promise<string> {
  performance.mark('create-project-graph-start');
  const projectGraph = await createProjectGraph(
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
 * File watcher subscription.
 */
let watcherSubscription: WatcherSubscription | undefined;

/**
 * We need to make sure that we instantiate the PerformanceObserver only once, otherwise
 * we will end up with duplicate entries in the server logs.
 */
let performanceObserver: PerformanceObserver | undefined;

const server = createServer((socket) => {
  if (!performanceObserver) {
    performanceObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      // Slight indentation to improve readability of the overall log file
      nestedLog(`Time taken for '${entry.name}'`, `${entry.duration}ms`);
    });
    performanceObserver.observe({ entryTypes: ['measure'], buffered: false });
  }

  socket.on('data', async (data) => {
    /**
     * If anything other than the known project graph creation request payload is sent to
     * the server, we throw an error.
     */
    const payload = data.toString();
    if (payload !== 'REQUEST_PROJECT_GRAPH_PAYLOAD') {
      throw new Error(`Unsupported payload sent to daemon server: ${payload}`);
    }

    performance.mark('server-connection');
    requestLog('Client Request for Project Graph Received');

    const currentGitHead = gitRevParseHead(appRootPath);

    let serializedProjectGraph: string | undefined;

    /**
     * Cached HEAD has changed, we must perform full file-hashing initialization work and
     * recompute the project graph
     */
    if (currentGitHead !== cachedGitHead) {
      cachedSerializedProjectGraph = undefined;
      nestedLog(
        `Cached HEAD does not match current (${currentGitHead}), performing full file hash init and recomputing project graph...`
      );
      defaultFileHasher.init();
      cachedGitHead = currentGitHead;
      serializedProjectGraph = await createAndSerializeProjectGraph();
    } else {
      /**
       * We know at this point that the cached HEAD has not changed so now there are two possibilities:
       *
       * 1) We have not computed the project graph and cached it for the untracked and uncommitted changes
       * and need to ask git for this information (slower)
       *
       * 2) We already have a cached serialized project graph (which we trust has been kept up to date
       * by the file watching logic) so we can immediately resolve it to the client (faster)
       */
      if (cachedSerializedProjectGraph) {
        nestedLog(
          `State unchanged since last request, resolving in-memory cached project graph...`
        );
        serializedProjectGraph = cachedSerializedProjectGraph;
      } else {
        // Update the file-hasher's knowledge of the untracked and uncommitted changes in order to recompute the project graph
        defaultFileHasher.incrementalUpdate(
          getUntrackedAndUncommittedFileHashes(appRootPath)
        );
        nestedLog(
          `Unknown untracked/uncommitted file state, recomputing project graph...`
        );
        serializedProjectGraph = await createAndSerializeProjectGraph();
      }
    }

    /**
     * Cache the latest version of the project graph in memory so that we can potentially skip a lot
     * of expensive work on the next client request.
     *
     * For reference, on the very large test repo https://github.com/vsavkin/interstellar the project
     * graph nxdeps.json file is about 32MB, so memory utilization should not be a huge concern.
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
      performance.measure(
        'total for server response',
        'server-connection',
        'serialized-project-graph-written-to-client'
      );
      const bytesWritten = Buffer.byteLength(serializedProjectGraph, 'utf-8');
      nestedLog(
        `Closed Connection to Client (${bytesWritten} bytes transferred)`
      );
    });
  });
});

/**
 * Server process termination clean up and logging.
 */
async function handleServerProcessTermination() {
  server.close();
  /**
   * Tear down any file watchers that may be running.
   */
  if (watcherSubscription) {
    await watcherSubscription.unsubscribe();
    watcherLog(`Unsubscribed from changes within: ${appRootPath}`);
  }
  serverLog('Server Stopped');
  logger.info('NX Daemon Server - Stopped');
  process.exit(0);
}

process
  .on('SIGINT', handleServerProcessTermination)
  .on('SIGTERM', handleServerProcessTermination)
  .on('SIGHUP', handleServerProcessTermination);

/**
 * When applicable files in the workspaces are changed (created, updated, deleted),
 * we need to recompute the cached serialized project graph so that it is readily
 * available for the next client request to the server.
 */
const handleWorkspaceChanges: SubscribeToWorkspaceChangesCallback = async (
  err,
  changeEvents
) => {
  /**
   * We know that something must have happened in the workspace so it makes sense
   * to proactively destroy any previous knowledge of the project graph at this point.
   */
  cachedSerializedProjectGraph = undefined;
  if (err || !changeEvents || !changeEvents.length) {
    watcherLog('Unexpected Error');
    console.error(err);
    return;
  }

  watcherLog(convertChangeEventsToLogMessage(changeEvents));

  /**
   * Update the file-hasher's knowledge of the non-deleted changed files in order to
   * recompute and cache the project graph in memory.
   */
  try {
    const filesToHash = [];
    const deletedFiles = [];
    for (const event of changeEvents) {
      if (event.type === 'delete') {
        deletedFiles.push(event.path);
      } else {
        filesToHash.push(event.path);
      }
    }
    performance.mark('hash-watched-changes-start');
    const updatedHashes = getGitHashForFiles(filesToHash, appRootPath);
    performance.mark('hash-watched-changes-end');
    performance.measure(
      'hash changed files from watcher',
      'hash-watched-changes-start',
      'hash-watched-changes-end'
    );
    defaultFileHasher.incrementalUpdate(updatedHashes);
    defaultFileHasher.removeFiles(deletedFiles);

    nestedLog(
      `Updated file-hasher based on watched changes, recomputing project graph...`
    );
    cachedSerializedProjectGraph = await createAndSerializeProjectGraph();
  } catch (err) {
    serverLog(`Unexpected Error`);
    console.error(err);
  }
};

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
    server.listen(FULL_OS_SOCKET_PATH, async () => {
      serverLog(`Started listening on: ${FULL_OS_SOCKET_PATH}`);

      if (!watcherSubscription) {
        watcherSubscription = await subscribeToWorkspaceChanges(
          handleWorkspaceChanges
        );
        watcherLog(`Subscribed to changes within: ${appRootPath}`);
      }

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
