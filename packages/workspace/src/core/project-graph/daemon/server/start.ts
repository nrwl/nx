import { logger } from '@nrwl/devkit';
import { startServer } from './server';

(async () => {
  try {
    await startServer();
  } catch (err) {
    logger.error(err);
  }
})();
