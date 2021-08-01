import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { join } from 'path';
import {
  cacheDirectory,
  readCacheDirectoryProperty,
} from '../../../utilities/cache-directory';

/**
 * Because daemon server utilities will be executed across completely different processes,
 * it is not possible for us to cache valuable metadata in memory. We therefore
 * instead leverage the existing node_modules/.cache/nx directory to create a new
 * file called daemon.json in order to track things such as the background processes
 * created by this utility so that they can be cleaned up appropriately.
 */
export interface DaemonJson {
  serverLogOutputFile: string;
  backgroundProcessId: number;
}

const nxDepsDir = cacheDirectory(
  appRootPath,
  readCacheDirectoryProperty(appRootPath)
);
export const daemonJsonPath = join(nxDepsDir, 'daemon.json');
