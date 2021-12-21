import { NxJsonConfiguration, readJsonFile } from '@nrwl/devkit';
import { join } from 'path';

export function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return nxJson.tasksRunnerOptions.default.options.cacheDirectory;
  } catch {
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
