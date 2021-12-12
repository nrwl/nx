import { logger } from '@nrwl/devkit';
import { startServer } from './server';
import * as process from 'process';

(async () => {
  try {
    await startServer();
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
})();
