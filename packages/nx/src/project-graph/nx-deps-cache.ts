import { existsSync } from 'fs';
import { ensureDirSync, renameSync } from 'fs-extra';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { NxJsonConfiguration } from '../config/nx-json';
import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { ProjectsConfigurations } from '../config/workspace-json-project-json';
import { projectGraphCacheDirectory } from '../utils/cache-directory';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { nxVersion } from '../utils/versions';

export interface ProjectFileMapCache {
  version: string;
  nxVersion: string;
  deps: Record<string, string>;
  pathMappings: Record<string, any>;
  nxJsonPlugins: { name: string; version: string }[];
  pluginsConfig?: any;
  projectFileMap: ProjectFileMap;
}

export const nxProjectGraph = join(
  projectGraphCacheDirectory,
  'project-graph.json'
);
export const nxFileMap = join(projectGraphCacheDirectory, 'file-map.json');

export function ensureCacheDirectory(): void {
  try {
    if (!existsSync(projectGraphCacheDirectory)) {
      ensureDirSync(projectGraphCacheDirectory);
    }
  } catch (e) {
    /*
     * @jeffbcross: Node JS docs recommend against checking for existence of directory immediately before creating it.
     * Instead, just try to create the directory and handle the error.
     *
     * We ran into race conditions when running scripts concurrently, where multiple scripts were
     * arriving here simultaneously, checking for directory existence, then trying to create the directory simultaneously.
     *
     * In this case, we're creating the directory. If the operation failed, we ensure that the directory
     * exists before continuing (or raise an exception).
     */
    if (!directoryExists(projectGraphCacheDirectory)) {
      throw new Error(
        `Failed to create directory: ${projectGraphCacheDirectory}`
      );
    }
  }
}

export function readProjectFileMapCache(): null | ProjectFileMapCache {
  performance.mark('read cache:start');
  ensureCacheDirectory();

  let data = null;
  try {
    if (fileExists(nxFileMap)) {
      data = readJsonFile(nxFileMap);
    }
  } catch (error) {
    console.log(
      `Error reading '${nxFileMap}'. Continue the process without the cache.`
    );
    console.log(error);
  }

  performance.mark('read cache:end');
  performance.measure('read cache', 'read cache:start', 'read cache:end');
  return data ?? null;
}

export function readProjectGraphCache(): null | ProjectGraph {
  performance.mark('read project-graph:start');
  ensureCacheDirectory();

  let data = null;
  try {
    if (fileExists(nxProjectGraph)) {
      data = readJsonFile(nxProjectGraph);
    }
  } catch (error) {
    console.log(
      `Error reading '${nxProjectGraph}'. Continue the process without the cache.`
    );
    console.log(error);
  }

  performance.mark('read project-graph:end');
  performance.measure(
    'read cache',
    'read project-graph:start',
    'read project-graph:end'
  );
  return data ?? null;
}

export function createProjectFileMapCache(
  nxJson: NxJsonConfiguration<'*' | string[]>,
  packageJsonDeps: Record<string, string>,
  projectFileMap: ProjectFileMap,
  tsConfig: { compilerOptions?: { paths?: { [p: string]: any } } }
) {
  const nxJsonPlugins = (nxJson.plugins || []).map((p) => ({
    name: p,
    version: packageJsonDeps[p],
  }));
  const newValue: ProjectFileMapCache = {
    version: '6.0',
    nxVersion: nxVersion,
    deps: packageJsonDeps, // TODO(v18): We can remove this in favor of nxVersion
    // compilerOptions may not exist, especially for package-based repos
    pathMappings: tsConfig?.compilerOptions?.paths || {},
    nxJsonPlugins,
    pluginsConfig: nxJson.pluginsConfig,
    projectFileMap,
  };
  return newValue;
}

export function writeCache(
  cache: ProjectFileMapCache,
  projectGraph: ProjectGraph
): void {
  performance.mark('write cache:start');
  let retry = 1;
  let done = false;
  do {
    // write first to a unique temporary filename and then do a
    // rename of the file to the correct filename
    // this is to avoid any problems with half-written files
    // in case of crash and/or partially written files due
    // to multiple parallel processes reading and writing this file
    const unique = (Math.random().toString(16) + '0000000').slice(2, 10);
    const tmpProjectGraphPath = `${nxProjectGraph}~${unique}`;
    const tmpFileMapPath = `${nxFileMap}~${unique}`;

    try {
      writeJsonFile(tmpProjectGraphPath, projectGraph);
      renameSync(tmpProjectGraphPath, nxProjectGraph);

      writeJsonFile(tmpFileMapPath, cache);
      renameSync(tmpFileMapPath, nxFileMap);
      done = true;
    } catch (err: any) {
      if (err instanceof Error) {
        console.log(
          `ERROR (${retry}) when writing \n${err.message}\n${err.stack}`
        );
      } else {
        console.log(
          `ERROR  (${retry}) unknown error when writing ${nxProjectGraph} and ${nxFileMap}`
        );
      }
      ++retry;
    }
  } while (!done && retry < 5);
  performance.mark('write cache:end');
  performance.measure('write cache', 'write cache:start', 'write cache:end');
}

export function shouldRecomputeWholeGraph(
  cache: ProjectFileMapCache,
  packageJsonDeps: Record<string, string>,
  projects: ProjectsConfigurations,
  nxJson: NxJsonConfiguration,
  tsConfig: { compilerOptions: { paths: { [k: string]: any } } }
): boolean {
  if (cache.version !== '6.0') {
    return true;
  }
  if (cache.nxVersion !== nxVersion) {
    return true;
  }

  // we have a cached project that is no longer present
  const cachedNodes = Object.keys(cache.projectFileMap);
  if (cachedNodes.some((p) => projects.projects[p] === undefined)) {
    return true;
  }

  // a path mapping for an existing project has changed
  if (
    Object.keys(cache.pathMappings).some((t) => {
      const cached =
        cache.pathMappings && cache.pathMappings[t]
          ? JSON.stringify(cache.pathMappings[t])
          : undefined;
      const notCached =
        tsConfig?.compilerOptions?.paths && tsConfig?.compilerOptions?.paths[t]
          ? JSON.stringify(tsConfig.compilerOptions.paths[t])
          : undefined;
      return cached !== notCached;
    })
  ) {
    return true;
  }

  // a new plugin has been added
  if ((nxJson.plugins || []).length !== cache.nxJsonPlugins.length) return true;

  // a plugin has changed
  if (
    (nxJson.plugins || []).some((t) => {
      const matchingPlugin = cache.nxJsonPlugins.find((p) => p.name === t);
      if (!matchingPlugin) return true;
      return matchingPlugin.version !== packageJsonDeps[t];
    })
  ) {
    return true;
  }

  if (
    JSON.stringify(nxJson.pluginsConfig) !== JSON.stringify(cache.pluginsConfig)
  ) {
    return true;
  }

  return false;
}

/*
This can only be invoked when the list of projects is either the same
or new projects have been added, so every project in the cache has a corresponding
project in fileMap
*/
export function extractCachedFileData(
  fileMap: ProjectFileMap,
  c: ProjectFileMapCache
): {
  filesToProcess: ProjectFileMap;
  cachedFileData: { [project: string]: { [file: string]: FileData } };
} {
  const filesToProcess: ProjectFileMap = {};
  const cachedFileData: Record<string, Record<string, FileData>> = {};
  const currentProjects = Object.keys(fileMap).filter(
    (name) => fileMap[name].length > 0
  );
  currentProjects.forEach((p) => {
    processProjectNode(
      p,
      c.projectFileMap,
      cachedFileData,
      filesToProcess,
      fileMap
    );
  });

  return {
    filesToProcess,
    cachedFileData,
  };
}

function processProjectNode(
  projectName: string,
  cachedFileMap: ProjectFileMap,
  cachedFileData: { [project: string]: { [file: string]: FileData } },
  filesToProcess: ProjectFileMap,
  fileMap: ProjectFileMap
) {
  if (!cachedFileMap[projectName]) {
    filesToProcess[projectName] = fileMap[projectName];
    return;
  }

  const fileDataFromCache = {} as any;
  for (let f of cachedFileMap[projectName]) {
    fileDataFromCache[f.file] = f;
  }

  if (!cachedFileData[projectName]) {
    cachedFileData[projectName] = {};
  }

  for (let f of fileMap[projectName]) {
    const fromCache = fileDataFromCache[f.file];
    if (fromCache && fromCache.hash == f.hash) {
      cachedFileData[projectName][f.file] = fromCache;
    } else {
      if (!filesToProcess[projectName]) {
        filesToProcess[projectName] = [];
      }
      filesToProcess[projectName].push(f);
    }
  }
}
