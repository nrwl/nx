import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { remove } from 'fs-extra';
import { stop as stopDaemon } from '../core/project-graph/daemon/client/client';
import {
  cacheDirectory,
  readCacheDirectoryProperty,
} from '../utilities/cache-directory';
import { output } from '../utilities/output';

export async function resetHandler() {
  output.note({
    title: 'Resetting the Nx workspace cache and stopping the Nx Daemon.',
    bodyLines: [`This might take a few minutes.`],
  });
  const dir = cacheDirectory(
    appRootPath,
    readCacheDirectoryProperty(appRootPath)
  );
  await Promise.all([stopDaemon(), remove(dir)]);
  output.success({
    title: 'Successful reset the Nx workspace.',
  });
}
