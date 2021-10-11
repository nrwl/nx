import { logger } from '@nrwl/devkit';
import { deleteDaemonJsonCache, readDaemonJsonCache } from '../cache';
import { stopServer } from './server';

(async () => {
  try {
    await stopServer();

    // Clean up any orphaned background process and clear cached metadata
    const cachedDaemonJson = await readDaemonJsonCache();
    if (cachedDaemonJson) {
      if (cachedDaemonJson.backgroundProcessId) {
        try {
          process.kill(cachedDaemonJson.backgroundProcessId);
        } catch {}
      }
      deleteDaemonJsonCache();
    }
  } catch (err) {
    logger.error(err);
  }
})();
