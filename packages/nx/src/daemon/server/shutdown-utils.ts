import { workspaceRoot } from '../../utils/workspace-root';
import type { Server, Socket } from 'net';
import { serverLogger } from '../logger';
import { serializeResult } from '../socket-utils';
import { deleteDaemonJsonProcessCache } from '../cache';
import type { Watcher } from '../../native';
import {
  DaemonProjectGraphError,
  ProjectGraphError,
} from '../../project-graph/error-types';
import { removeDbConnections } from '../../utils/db-connection';
import { cleanupPlugins } from '../../project-graph/plugins/get-plugins';
import { MESSAGE_END_SEQ } from '../../utils/consume-messages-from-socket';
import { cleanupLatestNxInstallation } from './nx-console-operations';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { open } from 'fs/promises';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  DAEMON_OUTPUT_LOG_FILE,
} from '../tmp-dir';

export const SERVER_INACTIVITY_TIMEOUT_MS = 10800000 as const; // 10800000 ms = 3 hours

async function startNewDaemonInBackground() {
  mkdirSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE, { recursive: true });
  if (!existsSync(DAEMON_OUTPUT_LOG_FILE)) {
    writeFileSync(DAEMON_OUTPUT_LOG_FILE, '');
  }

  const out = await open(DAEMON_OUTPUT_LOG_FILE, 'a');
  const err = await open(DAEMON_OUTPUT_LOG_FILE, 'a');

  // Use require.resolve to find the currently installed version's start.js
  // instead of using __dirname which points to the old running daemon's path
  // Resolve from workspace root to pick up the correct symlink target
  let startScriptPath: string;
  try {
    // First resolve the nx package.json to find the package root
    const nxPackageJsonPath = require.resolve('nx/package.json', {
      paths: [workspaceRoot],
    });
    // Then build the path to start.js from the package root
    const nxPackageRoot = dirname(nxPackageJsonPath);
    startScriptPath = join(nxPackageRoot, 'src/daemon/server/start.js');
  } catch (e) {
    // Fall back to using __dirname if resolution fails
    serverLogger.log(
      `Failed to resolve nx package, falling back to __dirname: ${e.message}`
    );
    startScriptPath = join(__dirname, '../server/start.js');
  }
  serverLogger.log(`Restarting daemon with script: ${startScriptPath}`);
  serverLogger.log(`Old daemon __dirname: ${__dirname}`);
  serverLogger.log(`Current process.execPath: ${process.execPath}`);

  const backgroundProcess = spawn(process.execPath, [startScriptPath], {
    cwd: workspaceRoot,
    stdio: ['ignore', out.fd, err.fd],
    detached: true,
    windowsHide: false,
    shell: false,
    env: process.env,
  });
  backgroundProcess.unref();

  serverLogger.log('Started new daemon process in background');
}

let watcherInstance: Watcher | undefined;

export function storeWatcherInstance(instance: Watcher) {
  watcherInstance = instance;
}

export function getWatcherInstance() {
  return watcherInstance;
}

let outputWatcherInstance: Watcher | undefined;

export function storeOutputWatcherInstance(instance: Watcher) {
  outputWatcherInstance = instance;
}

export function getOutputWatcherInstance() {
  return outputWatcherInstance;
}

interface HandleServerProcessTerminationParams {
  server: Server;
  reason: string;
  sockets: Iterable<Socket>;
}

export async function handleServerProcessTermination({
  server,
  reason,
  sockets,
}: HandleServerProcessTerminationParams) {
  await performShutdown(server, reason, sockets);
}

export async function handleServerProcessTerminationWithRestart({
  server,
  reason,
  sockets,
}: HandleServerProcessTerminationParams) {
  // Clean up old daemon cache before starting new instance
  deleteDaemonJsonProcessCache();
  // Start new daemon before shutting down
  await startNewDaemonInBackground();
  await performShutdown(server, reason, sockets);
}

async function performShutdown(
  server: Server,
  reason: string,
  sockets: Iterable<Socket>
) {
  try {
    await new Promise((res) => {
      server.close(() => {
        res(null);
      });

      for (const socket of sockets) {
        socket.destroy();
      }
    });

    if (watcherInstance) {
      await watcherInstance.stop();
      serverLogger.watcherLog(
        `Stopping the watcher for ${workspaceRoot} (sources)`
      );
    }

    if (outputWatcherInstance) {
      await outputWatcherInstance.stop();
      serverLogger.watcherLog(
        `Stopping the watcher for ${workspaceRoot} (outputs)`
      );
    }

    deleteDaemonJsonProcessCache();
    cleanupPlugins();

    removeDbConnections();

    // Clean up Nx Console latest installation
    cleanupLatestNxInstallation();

    serverLogger.log(`Server stopped because: "${reason}"`);
  } finally {
    process.exit(0);
  }
}

let serverInactivityTimerId: NodeJS.Timeout | undefined;

export function resetInactivityTimeout(cb: () => void): void {
  if (serverInactivityTimerId) {
    clearTimeout(serverInactivityTimerId);
  }
  serverInactivityTimerId = setTimeout(cb, SERVER_INACTIVITY_TIMEOUT_MS);
}

export function respondToClient(
  socket: Socket,
  response: string,
  description: string
) {
  return new Promise(async (res) => {
    if (description) {
      serverLogger.requestLog(`Responding to the client.`, description);
    }
    socket.write(response + MESSAGE_END_SEQ, (err) => {
      if (err) {
        console.error(err);
      }
      serverLogger.log(`Done responding to the client`, description);
      res(null);
    });
  });
}

export async function respondWithErrorAndExit(
  socket: Socket,
  description: string,
  error: Error
) {
  const isProjectGraphError = error instanceof DaemonProjectGraphError;
  const normalizedError = isProjectGraphError
    ? ProjectGraphError.fromDaemonProjectGraphError(error)
    : error;

  // print some extra stuff in the error message
  serverLogger.requestLog(
    `Responding to the client with an error.`,
    description,
    normalizedError.message
  );
  console.error(normalizedError.stack);

  // Respond with the original error
  await respondToClient(socket, serializeResult(error, null, null), null);

  // Project Graph errors are okay. Restarting the daemon won't help with this.
  if (!isProjectGraphError) {
    process.exit(1);
  }
}
