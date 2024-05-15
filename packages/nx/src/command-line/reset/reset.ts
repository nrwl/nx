import { rmSync } from 'fs-extra';
import { daemonClient } from '../../daemon/client/client';
import {
  cacheDir,
  projectGraphCacheDirectory,
} from '../../utils/cache-directory';
import { output } from '../../utils/output';
import { getCloudClient } from '../../nx-cloud/utilities/client';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';

export async function resetHandler() {
  // Shutdown daemon
  output.note({
    title: 'Resetting the Nx workspace cache and stopping the Nx Daemon.',
    bodyLines: [`This might take a few minutes.`],
  });
  await daemonClient.stop();
  output.log({ title: 'Daemon Server - Stopped' });
  
  // Remove Nx Cache files
  rmSync(cacheDir, { recursive: true, force: true });
  
  if (projectGraphCacheDirectory !== cacheDir) {
    rmSync(projectGraphCacheDirectory, { recursive: true, force: true });
  }

  // Remove nx cloud marker files. This helps if the use happens to run `nx-cloud start-ci-run` or 
  // similar commands on their local machine.
  try {
    (await getCloudClient(getCloudOptions())).invoke('cleanup')
  } catch {}

  output.success({
    title: 'Successfully reset the Nx workspace.',
  });
}
