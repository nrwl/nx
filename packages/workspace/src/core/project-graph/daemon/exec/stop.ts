/**
 * NOTE: This file is intended to be executed as a script by utilities found in ./index.ts
 */
import { logger } from '@nrwl/devkit';
import { existsSync, readJson, unlinkSync } from 'fs-extra';
import { DaemonJson, daemonJsonPath } from '../cache';
import { stopServer } from '../server';

(async () => {
  try {
    await stopServer();

    // Clean up any orphaned background process and clear cached metadata
    if (existsSync(daemonJsonPath)) {
      const daemonJson: DaemonJson = await readJson(daemonJsonPath);
      if (daemonJson?.backgroundProcessId) {
        process.kill(daemonJson?.backgroundProcessId);
      }
      unlinkSync(daemonJsonPath);
    }
  } catch (err) {
    logger.error(err);
  }
})();
