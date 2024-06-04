import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import { NxJsonConfiguration } from '../config/nx-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return (
      nxJson.cacheDirectory ??
      nxJson.tasksRunnerOptions?.default.options.cacheDirectory
    );
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

function pickCacheDirectory(
  root: string,
  nonNxCacheDirectory: string,
  nxCacheDirectory: string
) {
  // If nx.json doesn't exist the repo can't utilize
  // caching, so .nx/cache is less relevant. Lerna users
  // that don't want to fully opt in to Nx at this time
  // may also be caught off guard by the appearance of
  // a .nx directory, so we are going to special case
  // this for the time being.
  if (
    existsSync(join(root, 'lerna.json')) &&
    !existsSync(join(root, 'nx.json'))
  ) {
    return join(root, 'node_modules', '.cache', nonNxCacheDirectory);
  }
  return join(root, '.nx', nxCacheDirectory);
}

function defaultCacheDirectory(root: string) {
  return pickCacheDirectory(root, 'nx', 'cache');
}

function defaultWorkspaceDataDirectory(root: string) {
  return pickCacheDirectory(root, 'nx-workspace-data', 'workspace-data');
}

/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 */
export const cacheDir = cacheDirectory(
  workspaceRoot,
  readCacheDirectoryProperty(workspaceRoot)
);

export function cacheDirectoryForWorkspace(workspaceRoot: string) {
  return cacheDirectory(
    workspaceRoot,
    readCacheDirectoryProperty(workspaceRoot)
  );
}

export const workspaceDataDirectory = absolutePath(
  workspaceRoot,
  process.env.NX_WORKSPACE_DATA_DIRECTORY ??
    process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ??
    defaultWorkspaceDataDirectory(workspaceRoot)
);
