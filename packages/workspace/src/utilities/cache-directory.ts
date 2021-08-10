import { join } from 'path';
import { readJsonFile } from './fileutils';

export function readCacheDirectoryProperty(root: string) {
  const cacheDir = process.env.NX_CACHE_DIRECTORY;
  if (cacheDir) {
    return cacheDir;
  }
  try {
    const nxJson = readJsonFile(join(root, 'nx.json'));
    return nxJson.tasksRunnerOptions.default.options.cacheDirectory;
  } catch (e) {
    return undefined;
  }
}

export function cacheDirectory(root: string, cacheDirectory: string) {
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
