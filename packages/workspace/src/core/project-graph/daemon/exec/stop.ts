/**
 * NOTE: This file is intended to be executed as a script by utilities found in ./index.ts
 */
import { logger } from '@nrwl/devkit';
import { deleteDaemonJsonCache, readDaemonJsonCache } from '../cache';
import { stopServer } from '../server';

(async () => {
  try {
    await stopServer();

    // Clean up any orphaned background process and clear cached metadata
    const cachedDaemonJson = await readDaemonJsonCache();
    if (cachedDaemonJson) {
      if (cachedDaemonJson.backgroundProcessId) {
        process.kill(cachedDaemonJson.backgroundProcessId);
      }
      deleteDaemonJsonCache();
    }
  } catch (err) {
    logger.error(err);
  }
})();
