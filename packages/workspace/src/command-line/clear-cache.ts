import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import {
  cacheDirectory,
  readCacheDirectoryProperty,
} from '../utilities/cache-directory';
import { removeSync } from 'fs-extra';
import { output } from '../utilities/output';

export const clearCache = {
  command: 'clear-cache',
  describe:
    'Clears all the cached Nx artifacts and metadata about the workspace.',
  handler: clearCacheHandler,
};

async function clearCacheHandler() {
  output.note({
    title: 'Deleting the cache directory.',
    bodyLines: [`This might take a few minutes.`],
  });
  const dir = cacheDirectory(
    appRootPath,
    readCacheDirectoryProperty(appRootPath)
  );
  removeSync(dir);
  output.success({
    title: 'Deleted the cache directory.',
  });
}
