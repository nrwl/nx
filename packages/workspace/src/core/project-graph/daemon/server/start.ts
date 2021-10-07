/**
 * NOTE: This file is intended to be executed as a script by utilities found in ./index.ts
 */
import { logger } from '@nrwl/devkit';
import { startServer } from './server';

const serverLogOutputFile = process.argv[2];

(async () => {
  try {
    if (!serverLogOutputFile) {
      logger.info(
        'NOTE: Running Daemon Server in current process, all logs are shown inline below:\n'
      );
    }
    await startServer({ serverLogOutputFile });
  } catch (err) {
    logger.error(err);
  }
})();
