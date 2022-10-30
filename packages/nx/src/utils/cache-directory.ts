import { isAbsolute, join } from 'path';
import { NxJsonConfiguration } from '../config/nx-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

export interface CacheDirectorySpec {
  envName?: string;
  propertyName?: string;
  defaultDirectory?: string;
}

/**
 * Calculate path to a cache directory
 * The path is calculated by looking at these values in order of precedense:
 * env[cache.envName]
 * nxConfig.tasksRunnerOptions.default.options[cache.propertyName]
 * cache.defaultDirectory
 *
 * if the resulting path from the above rule is not an absolute path
 * it will be prefixed with root
 *
 * @param root : the root of the workspace
 * @param env : the environment - e.g. process.env
 * @param nxConfig : the content of the workspace nx.json
 * @param cache : the specification of the cache :
 * -              envName: the optional property in env that may define the cache
 * -              propertyName: the optional property in
 * -                            nxConfig.tasksRunnerOptions.default.options
 * -                            that may define the cache
 * -              defaultDirectory: the cache directory path if none of the
 * -                                above defines the path
 * @returns
 */
export function cacheDirectory(
  root: string,
  env: { [key: string]: string },
  nxConfig: NxJsonConfiguration,
  cache: CacheDirectorySpec
): string {
  let directory = '';
  if (cache.envName && env[cache.envName]) {
    directory = env[cache.envName];
  } else if (
    cache.propertyName &&
    nxConfig.tasksRunnerOptions?.default?.options[cache.propertyName]
  ) {
    directory =
      nxConfig.tasksRunnerOptions?.default?.options[cache.propertyName];
  } else {
    directory = cache.defaultDirectory;
  }

  if (directory) {
    if (isAbsolute(directory)) {
      return directory;
    } else {
      return join(root, directory);
    }
  }
  return '';
}

let nxJson: NxJsonConfiguration;
//temporarily keep a value of workspace nx.json
try {
  nxJson = readJsonFile<NxJsonConfiguration>(join(workspaceRoot, 'nx.json'));
} catch (_err: any) {
  nxJson = {};
}

/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 * It is defined in order of precedence:
 * environment variable NX_CACHE_DIRECTORY
 * nx.json tasksRunnerOptions.default.options.cacheDirectory
 * node_modules/.cache/nx
 *
 * if the resulting path from the above rule is not an absolute path
 * it will be prefixed with the workspace root path
 */
export const cacheDir = cacheDirectory(workspaceRoot, process.env, nxJson, {
  envName: 'NX_CACHE_DIRECTORY',
  propertyName: 'cacheDirectory',
  defaultDirectory: join('node_modules', '.cache', 'nx'),
});

/**
 * Path to the directory where Nx stores its cache of project dependencies and
 * logs from the Nx Daemon in case it is active.
 * It is defined in order of precedence:
 * environment variable NX_PROJECT_GRAPH_CACHE_DIRECTORY
 * node_modules/.cache/nx
 *
 * if the resulting path from the above rule is not an absolute path
 * it will be prefixed with the workspace root path
 */
export const projectGraphCacheDirectory = cacheDirectory(
  workspaceRoot,
  process.env,
  nxJson,
  {
    envName: 'NX_PROJECT_GRAPH_CACHE_DIRECTORY',
    defaultDirectory: join('node_modules', '.cache', 'nx'),
  }
);

//now release nxJson to be garbage collected
nxJson = undefined;
