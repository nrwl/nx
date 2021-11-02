import { logger } from '@nrwl/devkit';
import type { Arguments } from 'yargs';
import { DAEMON_OUTPUT_LOG_FILE } from '../core/project-graph/daemon/tmp-dir';

export async function daemonHandler(args: Arguments) {
  const { startInBackground, startInCurrentProcess } = await import(
    '../core/project-graph/daemon/client/client'
  );
  if (!args.background) {
    return startInCurrentProcess();
  }
  logger.info(`NX Daemon Server - Starting in a background process...`);
  const pid = await startInBackground();
  logger.log(
    `  Logs from the Daemon process (ID: ${pid}) can be found here: ${DAEMON_OUTPUT_LOG_FILE}\n`
  );
}
