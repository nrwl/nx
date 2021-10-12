import { FileData, logger, normalizePath, ProjectFileMap } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { createServer, Server, Socket } from 'net';
import { join } from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import {
  createProjectFileMap,
  readWorkspaceJson,
  updateProjectFileMap,
} from '../../../file-utils';
import { defaultFileHasher } from '../../../hasher/file-hasher';
import { getGitHashForFiles } from '../../../hasher/git-hasher';
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
import { buildProjectGraphUsingProjectFileMap } from '../../build-project-graph';
import { workspaceConfigName } from '@nrwl/tao/src/shared/workspace';
import { ProjectGraphCache } from '../../../nx-deps/nx-deps-cache';
import { readCache } from '../../../nx-deps/nx-deps-cache';

interface InterimProjectGraphResult {
  error: Error | null;
  serializedProjectGraph: string | null;
}

const configName = workspaceConfigName(appRootPath);
let cachedSerializedProjectGraphPromise: Promise<InterimProjectGraphResult>;
let projectFileMapWithFiles:
  | { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] }
  | undefined;
let currentProjectGraphCache: ProjectGraphCache | undefined;

async function createAndSerializeProjectGraph(
  updatedFiles: Map<string, string>,
  deletedFiles: string[],
  shouldWriteCache: boolean
): Promise<InterimProjectGraphResult> {
  try {
    performance.mark('create-project-graph-start');
    const workspaceJson = readWorkspaceJson();
    projectFileMapWithFiles = projectFileMapWithFiles
      ? updateProjectFileMap(
          workspaceJson,
          projectFileMapWithFiles.projectFileMap,
          projectFileMapWithFiles.allWorkspaceFiles,
          updatedFiles,
          deletedFiles
        )
      : createProjectFileMap(workspaceJson);
    const { projectGraph, projectGraphCache } =
      await buildProjectGraphUsingProjectFileMap(
        workspaceJson,
        projectFileMapWithFiles.projectFileMap,
        projectFileMapWithFiles.allWorkspaceFiles,
        currentProjectGraphCache || readCache(),
        shouldWriteCache,
        '4.0'
      );
    currentProjectGraphCache = projectGraphCache;

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

    return {
      error: null,
      serializedProjectGraph,
    };
  } catch (err) {
    return {
      error: err,
      serializedProjectGraph: null,
    };
  }
}

function respondToClient(socket: Socket, message: string) {
  socket.write(message, () => {
    // Close the connection once all data has been written so that the client knows when to read it.
    socket.end();
    serverLogger.nestedLog(`Closed Connection to Client`);
  });
}

let watcherSubscription: WatcherSubscription | undefined;
let performanceObserver: PerformanceObserver | undefined;

const server = createServer((socket) => {
  resetInactivityTimeout(handleInactivityTimeout);
  if (!performanceObserver) {
    performanceObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      serverLogger.nestedLog(
        `Time taken for '${entry.name}'`,
        `${entry.duration}ms`
      );
    });
    performanceObserver.observe({ entryTypes: ['measure'], buffered: false });
  }

  socket.on('data', async (data) => {
    resetInactivityTimeout(handleInactivityTimeout);

    const payload = data.toString();
    if (payload !== 'REQUEST_PROJECT_GRAPH_PAYLOAD') {
      throw new Error(`Unsupported payload sent to daemon server: ${payload}`);
    }

    performance.mark('server-connection');
    serverLogger.requestLog('Client Request for Project Graph Received');

    if (!cachedSerializedProjectGraphPromise) {
      cachedSerializedProjectGraphPromise = createAndSerializeProjectGraph(
        new Map(),
        [],
        true
      );
    }
    const result = await cachedSerializedProjectGraphPromise;

    if (result.error) {
      cachedSerializedProjectGraphPromise = undefined;
      serverLogger.nestedLog(
        `Error when preparing serialized project graph: ${result.error.message}`
      );
      respondToClient(
        socket,
        serializeResult(result.error, result.serializedProjectGraph)
      );
      return;
    }

    const serializedResult = serializeResult(
      result.error,
      result.serializedProjectGraph
    );
    if (!serializedResult) {
      cachedSerializedProjectGraphPromise = undefined;
      serverLogger.nestedLog(`Error when serializing project graph result`);
      respondToClient(
        socket,
        serializeResult(
          new Error(
            'Critical error when serializing server result, check server logs'
          ),
          null
        )
      );
      return;
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
      serverLogger.nestedLog(
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
  } catch {
    serverLogger.nestedLog(
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
    serverLogger.watcherLog('Unexpected Error');
    console.error(err);
    return;
  }

  serverLogger.watcherLog(convertChangeEventsToLogMessage(changeEvents));

  cachedSerializedProjectGraphPromise = new Promise(async (res) => {
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
      const updatedFiles = getGitHashForFiles(filesToHash, appRootPath);
      performance.mark('hash-watched-changes-end');
      performance.measure(
        'hash changed files from watcher',
        'hash-watched-changes-start',
        'hash-watched-changes-end'
      );
      defaultFileHasher.incrementalUpdate(updatedFiles, deletedFiles);
      serverLogger.nestedLog(
        `Updated file-hasher based on watched changes, recomputing project graph...`
      );
      // when workspace.json changes we cannot be sure about the correctness of the project file map
      if (
        updatedFiles.has(configName) ||
        deletedFiles.indexOf(configName) > -1
      ) {
        projectFileMapWithFiles = undefined;
      }
      res(
        await createAndSerializeProjectGraph(updatedFiles, deletedFiles, true)
      );
    } catch (err) {
      serverLogger.log(`Unexpected Error`);
      console.error(err);
    }
  });
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
      logger.info('NX Daemon Server - Stopped');
      return resolve();
    });
  });
}
