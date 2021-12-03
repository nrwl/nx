import { logger, normalizePath, stripIndents } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { createServer, Server, Socket } from 'net';
import { join } from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import {
  FULL_OS_SOCKET_PATH,
  isWindows,
  killSocketOrPath,
  serializeResult,
} from '../socket-utils';
import { serverLogger } from './logger';
import {
  handleServerProcessTermination,
  resetInactivityTimeout,
  SERVER_INACTIVITY_TIMEOUT_MS,
} from './shutdown-utils';
import {
  convertChangeEventsToLogMessage,
  subscribeToWorkspaceChanges,
  SubscribeToWorkspaceChangesCallback,
  WatcherSubscription,
} from './watcher';
import {
  addUpdatedAndDeletedFiles,
  getCachedSerializedProjectGraphPromise,
} from './project-graph-incremental-recomputation';
import { statSync } from 'fs';

function respondToClient(socket: Socket, message: string) {
  return new Promise((res) => {
    socket.write(message, () => {
      // Close the connection once all data has been written so that the client knows when to read it.
      socket.end();
      serverLogger.log(`Closed Connection to Client`);
      res(null);
    });
  });
}

let watcherSubscription: WatcherSubscription | undefined;
let performanceObserver: PerformanceObserver | undefined;
let watcherError: Error | undefined;

async function respondWithErrorAndExit(
  socket: Socket,
  description: string,
  error: Error
) {
  // print some extra stuff in the error message
  serverLogger.requestLog(
    `Responding to the client with an error`,
    description,
    error.message
  );
  console.error(error);

  error.message = stripIndents`
    ${error.message}
    ${description}
    Because of the error the Nx daemon process has exited. The next Nx command is going to restart the daemon process.
    If the error persists, please run "nx reset".
  `;

  await respondToClient(socket, serializeResult(error, null));
  process.exit(1);
}

const server = createServer(async (socket) => {
  resetInactivityTimeout(handleInactivityTimeout);
  if (!performanceObserver) {
    performanceObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      serverLogger.log(`Time taken for '${entry.name}'`, `${entry.duration}ms`);
    });
    performanceObserver.observe({ entryTypes: ['measure'], buffered: false });
  }

  socket.on('data', async (data) => {
    if (watcherError) {
      await respondWithErrorAndExit(
        socket,
        `File watcher error in the workspace '${appRootPath}'.`,
        watcherError
      );
    }

    resetInactivityTimeout(handleInactivityTimeout);

    const payload = data.toString();
    if (payload !== 'REQUEST_PROJECT_GRAPH_PAYLOAD') {
      await respondWithErrorAndExit(
        socket,
        null,
        new Error(`Unsupported payload sent to daemon server: ${payload}`)
      );
    }

    performance.mark('server-connection');
    serverLogger.requestLog('Client Request for Project Graph Received');

    const result = await getCachedSerializedProjectGraphPromise();
    if (result.error) {
      await respondWithErrorAndExit(
        socket,
        `Error when preparing serialized project graph.`,
        result.error
      );
    }

    const serializedResult = serializeResult(
      result.error,
      result.serializedProjectGraph
    );
    if (!serializedResult) {
      await respondWithErrorAndExit(
        socket,
        `Error when serializing project graph result.`,
        new Error(
          'Critical error when serializing server result, check server logs'
        )
      );
    }

    performance.mark('serialized-project-graph-ready');
    performance.measure(
      'total for creating and serializing project graph',
      'server-connection',
      'serialized-project-graph-ready'
    );

    socket.write(serializedResult, () => {
      performance.mark('serialized-project-graph-written-to-client');
      performance.measure(
        'write project graph to socket',
        'serialized-project-graph-ready',
        'serialized-project-graph-written-to-client'
      );
      // Close the connection once all data has been written so that the client knows when to read it.
      socket.end();
      performance.measure(
        'total for server response',
        'server-connection',
        'serialized-project-graph-written-to-client'
      );
      const bytesWritten = Buffer.byteLength(
        result.serializedProjectGraph,
        'utf-8'
      );
      serverLogger.requestLog(
        `Closed Connection to Client (${bytesWritten} bytes transferred)`
      );
    });
  });
});

function handleInactivityTimeout() {
  handleServerProcessTermination({
    server,
    watcherSubscription,
    reason: `${SERVER_INACTIVITY_TIMEOUT_MS}ms of inactivity`,
  });
}

process
  .on('SIGINT', () =>
    handleServerProcessTermination({
      server,
      watcherSubscription,
      reason: 'received process SIGINT',
    })
  )
  .on('SIGTERM', () =>
    handleServerProcessTermination({
      server,
      watcherSubscription,
      reason: 'received process SIGTERM',
    })
  )
  .on('SIGHUP', () =>
    handleServerProcessTermination({
      server,
      watcherSubscription,
      reason: 'received process SIGHUP',
    })
  );

function requireUncached(module: string): unknown {
  delete require.cache[require.resolve(module)];
  return require(module);
}

/**
 * We need to ensure that the server shuts down if the Nx installation changes.
 */
let cachedNxVersion: string | null = resolveCurrentNxVersion();

function resolveCurrentNxVersion(): string | null {
  const nrwlWorkspacePackageJsonPath = normalizePath(
    join(appRootPath, 'node_modules/@nrwl/workspace/package.json')
  );
  try {
    const { version } = requireUncached(nrwlWorkspacePackageJsonPath) as {
      version: string;
    };
    return version;
  } catch (err) {
    serverLogger.log(
      `Error: Could not determine the current Nx version by inspecting: ${nrwlWorkspacePackageJsonPath}`
    );
    return null;
  }
}

function isNxVersionSame(currentNxVersion: string | null): boolean {
  if (currentNxVersion === null) {
    // Something has gone wrong with figuring out the Nx version, declare the version as having changed
    return false;
  }
  return currentNxVersion === cachedNxVersion;
}

/**
 * When applicable files in the workspaces are changed (created, updated, deleted),
 * we need to recompute the cached serialized project graph so that it is readily
 * available for the next client request to the server.
 */
const handleWorkspaceChanges: SubscribeToWorkspaceChangesCallback = async (
  err,
  changeEvents
) => {
  if (watcherError) {
    serverLogger.watcherLog(
      'Skipping handleWorkspaceChanges because of a previously recorded watcher error.'
    );
    return;
  }

  try {
    resetInactivityTimeout(handleInactivityTimeout);

    if (!isNxVersionSame(resolveCurrentNxVersion())) {
      await handleServerProcessTermination({
        server,
        watcherSubscription,
        reason: '@nrwl/workspace installation changed',
      });
      return;
    }

    if (err || !changeEvents || !changeEvents.length) {
      serverLogger.watcherLog('Unexpected watcher error', err.message);
      console.error(err);
      watcherError = err;
      return;
    }

    serverLogger.watcherLog(convertChangeEventsToLogMessage(changeEvents));

    const filesToHash = [];
    const deletedFiles = [];
    for (const event of changeEvents) {
      if (event.type === 'delete') {
        deletedFiles.push(event.path);
      } else {
        try {
          const s = statSync(join(appRootPath, event.path));
          if (!s.isDirectory()) {
            filesToHash.push(event.path);
          }
        } catch (e) {
          // this can happen when the update file was deleted right after
        }
      }
    }
    addUpdatedAndDeletedFiles(filesToHash, deletedFiles);
  } catch (err) {
    serverLogger.watcherLog(`Unexpected error`, err.message);
    console.error(err);
    watcherError = err;
  }
};

export async function startServer(): Promise<Server> {
  // See notes in socket-utils.ts on OS differences regarding clean up of existings connections.
  if (!isWindows) {
    killSocketOrPath();
  }
  return new Promise((resolve) => {
    server.listen(FULL_OS_SOCKET_PATH, async () => {
      serverLogger.log(`Started listening on: ${FULL_OS_SOCKET_PATH}`);

      if (!watcherSubscription) {
        watcherSubscription = await subscribeToWorkspaceChanges(
          handleWorkspaceChanges
        );
        serverLogger.watcherLog(`Subscribed to changes within: ${appRootPath}`);
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
      return resolve();
    });
  });
}
