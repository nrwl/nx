import { workspaceRoot } from '../../utils/workspace-root';
import { createServer, Server, Socket } from 'net';
import { join } from 'path';
import { PerformanceObserver } from 'perf_hooks';
import {
  FULL_OS_SOCKET_PATH,
  isWindows,
  killSocketOrPath,
} from '../socket-utils';
import { serverLogger } from './logger';
import {
  handleServerProcessTermination,
  resetInactivityTimeout,
  respondToClient,
  respondWithErrorAndExit,
  SERVER_INACTIVITY_TIMEOUT_MS,
} from './shutdown-utils';
import {
  convertChangeEventsToLogMessage,
  subscribeToWorkspaceChanges,
  SubscribeToWorkspaceChangesCallback,
  WatcherSubscription,
} from './watcher';
import { addUpdatedAndDeletedFiles } from './project-graph-incremental-recomputation';
import { existsSync, statSync } from 'fs';
import { HashingImpl } from '../../hasher/hashing-impl';
import { defaultFileHasher } from '../../hasher/file-hasher';
import { handleRequestProjectGraph } from './handle-request-project-graph';
import { handleProcessInBackground } from './handle-process-in-background';
import {
  handleOutputsHashesMatch,
  handleRecordOutputsHash,
} from './handle-output-contents';

let watcherSubscription: WatcherSubscription | undefined;
let performanceObserver: PerformanceObserver | undefined;
let watcherError: Error | undefined;

export type HandlerResult = {
  description: string;
  error?: any;
  response?: string;
};

const server = createServer(async (socket) => {
  resetInactivityTimeout(handleInactivityTimeout);
  if (!performanceObserver) {
    performanceObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      serverLogger.log(`Time taken for '${entry.name}'`, `${entry.duration}ms`);
    });
    performanceObserver.observe({ entryTypes: ['measure'] });
  }

  let message = '';
  socket.on('data', async (data) => {
    const chunk = data.toString();
    if (chunk.length === 0 || chunk.codePointAt(chunk.length - 1) != 4) {
      message += chunk;
    } else {
      message += chunk.substring(0, chunk.length - 1);
      await handleMessage(socket, message);
    }
  });
});

async function handleMessage(socket, data) {
  if (watcherError) {
    await respondWithErrorAndExit(
      socket,
      `File watcher error in the workspace '${workspaceRoot}'.`,
      watcherError
    );
  }

  if (lockFileChanged()) {
    await respondWithErrorAndExit(socket, `Lock files changed`, {
      name: '',
      message: 'LOCK-FILES-CHANGED',
    });
  }

  resetInactivityTimeout(handleInactivityTimeout);

  const unparsedPayload = data.toString();
  let payload;
  try {
    payload = JSON.parse(unparsedPayload);
  } catch (e) {
    await respondWithErrorAndExit(
      socket,
      `Invalid payload from the client`,
      new Error(`Unsupported payload sent to daemon server: ${unparsedPayload}`)
    );
  }

  if (payload.type === 'REQUEST_PROJECT_GRAPH') {
    await handleResult(socket, await handleRequestProjectGraph());
  } else if (payload.type === 'PROCESS_IN_BACKGROUND') {
    await handleResult(socket, await handleProcessInBackground(payload));
  } else if (payload.type === 'RECORD_OUTPUTS_HASH') {
    await handleResult(socket, await handleRecordOutputsHash(payload));
  } else if (payload.type === 'OUTPUTS_HASHES_MATCH') {
    await handleResult(socket, await handleOutputsHashesMatch(payload));
  } else {
    await respondWithErrorAndExit(
      socket,
      `Invalid payload from the client`,
      new Error(`Unsupported payload sent to daemon server: ${unparsedPayload}`)
    );
  }
}

async function handleResult(socket: Socket, hr: HandlerResult) {
  if (hr.error) {
    await respondWithErrorAndExit(socket, hr.description, hr.error);
  } else {
    await respondToClient(socket, hr.response, hr.description);
  }
}

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

let existingLockHash: string | undefined;

function lockFileChanged(): boolean {
  const hash = new HashingImpl();
  const lockHashes = [
    join(workspaceRoot, 'package-lock.json'),
    join(workspaceRoot, 'yarn.lock'),
    join(workspaceRoot, 'pnpm-lock.yaml'),
  ]
    .filter((file) => existsSync(file))
    .map((file) => hash.hashFile(file));
  const newHash = hash.hashArray(lockHashes);
  if (existingLockHash && newHash != existingLockHash) {
    existingLockHash = newHash;
    return true;
  } else {
    existingLockHash = newHash;
    return false;
  }
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

    if (lockFileChanged()) {
      await handleServerProcessTermination({
        server,
        watcherSubscription,
        reason: 'Lock file changed',
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
          const s = statSync(join(workspaceRoot, event.path));
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
  // See notes in socket-command-line-utils.ts on OS differences regarding clean up of existings connections.
  if (!isWindows) {
    killSocketOrPath();
  }
  await defaultFileHasher.ensureInitialized();
  return new Promise((resolve, reject) => {
    try {
      server.listen(FULL_OS_SOCKET_PATH, async () => {
        try {
          serverLogger.log(`Started listening on: ${FULL_OS_SOCKET_PATH}`);
          // this triggers the storage of the lock file hash
          lockFileChanged();

          if (!watcherSubscription) {
            watcherSubscription = await subscribeToWorkspaceChanges(
              server,
              handleWorkspaceChanges
            );
            serverLogger.watcherLog(
              `Subscribed to changes within: ${workspaceRoot}`
            );
          }
          return resolve(server);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
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
