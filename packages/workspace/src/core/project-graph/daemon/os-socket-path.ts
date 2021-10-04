import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { platform } from 'os';
import { join, resolve } from 'path';

/**
 * For IPC with with the daemon server we use unix sockets or windows named pipes, depending on the user's operating system.
 *
 * See https://nodejs.org/dist/latest-v14.x/docs/api/net.html#net_identifying_paths_for_ipc_connections for a full breakdown
 * of OS differences between Unix domain sockets and named pipes.
 *
 * We currently create the socket/pipe based on a path within the current workspace so that we maintain one unique daemon per
 * workspace to ensure that subtle differences between Nx workspaces cannot cause issues.
 */
const workspaceSocketPath = join(appRootPath, './nx-daemon.sock');

export const isWindows = platform() === 'win32';

export const FULL_OS_SOCKET_PATH = isWindows
  ? '\\\\.\\pipe\\nx\\' + resolve(workspaceSocketPath)
  : resolve(workspaceSocketPath);
