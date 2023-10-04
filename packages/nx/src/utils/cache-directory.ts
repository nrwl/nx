import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import { NxJsonConfiguration } from '../config/nx-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return nxJson.tasksRunnerOptions.default.options.cacheDirectory;
  } catch {
    return undefined;
  }
}

function absolutePath(root: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  } else {
    return join(root, path);
  }
}

function cacheDirectory(root: string, cacheDirectory: string) {
  const cacheDirFromEnv = process.env.NX_CACHE_DIRECTORY;
  if (cacheDirFromEnv) {
    cacheDirectory = cacheDirFromEnv;
  }
  if (cacheDirectory) {
    return absolutePath(root, cacheDirectory);
  } else {
    return defaultCacheDirectory(root);
  }
}

function defaultCacheDirectory(root: string) {
  return existsSync(join(root, '.nx'))
    ? join(root, '.nx', 'cache')
    : join(root, 'node_modules', '.cache', 'nx');
}

/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 */
export const cacheDir = cacheDirectory(
  workspaceRoot,
  readCacheDirectoryProperty(workspaceRoot)
);

export const projectGraphCacheDirectory = absolutePath(
  workspaceRoot,
  process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ??
    defaultCacheDirectory(workspaceRoot)
);
