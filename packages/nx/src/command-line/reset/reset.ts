import { rmSync } from 'fs';
import { daemonClient } from '../../daemon/client/client';
import {
  cacheDir,
  projectGraphCacheDirectory,
} from '../../utils/cache-directory';
import { output } from '../../utils/output';
import { execSync } from 'child_process';

export async function resetHandler() {
  output.note({
    title: 'Resetting the Nx workspace cache and stopping the Nx Daemon.',
    bodyLines: [`This might take a few minutes.`],
  });
  await daemonClient.stop();
  output.log({ title: 'Daemon Server - Stopped' });
  removeFolder(cacheDir);
  if (projectGraphCacheDirectory !== cacheDir) {
    removeFolder(projectGraphCacheDirectory);
  }
  output.success({
    title: 'Successfully reset the Nx workspace.',
  });
}

function removeFolder(path: string) {
  try {
    // this would obviously fail on windows
    // it's intention is to handle processes keeping folders locked on unix based systems
    execSync(`lsof -t ${path} | xargs kill`);
  } catch {}
  rmSync(path, { recursive: true, force: true });
}
