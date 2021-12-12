import { logger } from '@nrwl/devkit';
import { safelyCleanUpExistingProcess } from '../cache';
import { stopServer } from './server';

(async () => {
  try {
    await stopServer();
    await safelyCleanUpExistingProcess();
  } catch (err) {
    logger.error(err);
  }
})();
