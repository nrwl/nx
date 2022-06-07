import { join, isAbsolute } from 'path';
import { workspaceRoot } from './workspace-root';
import { readJsonFile } from './fileutils';
import { NxJsonConfiguration } from '../config/nx-json';

function readTaskRunnerOption(
  root: string,
  option: string
): string | undefined {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return nxJson.tasksRunnerOptions.default.options[option];
  } catch {
    return undefined;
  }
}

function cacheDirectory(root: string, cacheDirectory: string) {
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
  process.env.NX_CACHE_DIRECTORY ||
    readTaskRunnerOption(workspaceRoot, 'cacheDirectory')
);

/**
 * Path to the directory where Nx stores its nxdeps.json file
 */
export const depsDir = cacheDirectory(
  workspaceRoot,
  process.env.NX_DEPS_DIRECTORY ||
    readTaskRunnerOption(workspaceRoot, 'depsDirectory') ||
    readTaskRunnerOption(workspaceRoot, 'cacheDirectory')
);
