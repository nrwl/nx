/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { join } from 'path';
import { cacheDir } from '../../../utilities/cache-directory';

export const DAEMON_DIR_FOR_CURRENT_WORKSPACE = join(cacheDir, 'nx-daemon');

export const DAEMON_OUTPUT_LOG_FILE = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'server.log'
);

export const DAEMON_SOCKET_PATH = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  // As per notes above on socket/named pipe length limitations, we keep this intentionally short
  'd.sock'
);
