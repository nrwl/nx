import { join, isAbsolute } from 'path';
import { workspaceRoot } from 'nx/src/utils/app-root';
import { readJsonFile } from 'nx/src/utils/fileutils';
import { NxJsonConfiguration } from 'nx/src/shared/nx';

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

/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 */
export const cacheDir = cacheDirectory(
  workspaceRoot,
  readCacheDirectoryProperty(workspaceRoot)
);
