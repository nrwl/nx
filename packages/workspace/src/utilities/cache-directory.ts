import { NxJsonConfiguration, readJsonFile } from '@nrwl/devkit';
import { join, isAbsolute } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';

function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return nxJson.tasksRunnerOptions.default.options.cacheDirectory;
  } catch {
    return undefined;
  }
}

function cacheDirectory(root: string, cacheDirectory: string) {
  const cacheDirFromEnv = process.env.NX_CACHE_DIRECTORY;
  if (cacheDirFromEnv) {
    cacheDirectory = cacheDirFromEnv;
  }
  if (cacheDirectory) {
    if (isAbsolute(cacheDirectory)) {
      return cacheDirectory;
    } else {
      return join(root, cacheDirectory);
    }
  } else {
    return join(root, 'node_modules', '.cache', 'nx');
  }
}

export const cacheDir = cacheDirectory(
  appRootPath,
  readCacheDirectoryProperty(appRootPath)
);
