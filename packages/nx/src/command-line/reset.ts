import { removeSync } from 'fs-extra';
import { daemonClient } from '../daemon/client/client';
import { cacheDir, projectGraphCacheDirectory } from '../utils/cache-directory';
import { output } from '../utils/output';

export function resetHandler() {
  output.note({
    title: 'Resetting the Nx workspace cache and stopping the Nx Daemon.',
    bodyLines: [`This might take a few minutes.`],
  });
  daemonClient.stop();
  removeSync(cacheDir);
  if (projectGraphCacheDirectory !== cacheDir) {
    removeSync(projectGraphCacheDirectory);
  }
  output.success({
    title: 'Successfully reset the Nx workspace.',
  });
}
