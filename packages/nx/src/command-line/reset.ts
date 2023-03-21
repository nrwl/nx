import { removeSync } from 'fs-extra';
import { daemonClient } from '../daemon/client/client';
import { cacheDir, projectGraphCacheDirectory } from '../utils/cache-directory';
import { output } from '../utils/output';

export async function resetHandler() {
  output.note({
    title: 'Resetting the Nx workspace cache and stopping the Nx Daemon.',
    bodyLines: [`This might take a few minutes.`],
  });
  await daemonClient.stop();
  output.log({ title: 'Daemon Server - Stopped' });
  removeSync(cacheDir);
  if (projectGraphCacheDirectory !== cacheDir) {
    removeSync(projectGraphCacheDirectory);
  }
  output.success({
    title: 'Successfully reset the Nx workspace.',
  });
}
