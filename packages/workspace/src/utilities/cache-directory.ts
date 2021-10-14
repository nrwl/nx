import { NxJsonConfiguration } from '@nrwl/devkit';
import { join } from 'path';
import { readJsonFile } from './fileutils';

export function readCacheDirectoryProperty(root: string) {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return nxJson.tasksRunnerOptions.default.options.cacheDirectory;
  } catch (e) {
    return undefined;
  }
}

export function cacheDirectory(root: string, cacheDirectory: string) {
  const cacheDirFromEnv = process.env.NX_CACHE_DIRECTORY;
  if (cacheDirFromEnv) {
    cacheDirectory = cacheDirFromEnv;
  }
  if (cacheDirectory) {
    if (cacheDirectory.startsWith('./')) {
      return join(root, cacheDirectory);
    } else {
      return cacheDirectory;
    }
  } else {
    return join(root, 'node_modules', '.cache', 'nx');
  }
}
