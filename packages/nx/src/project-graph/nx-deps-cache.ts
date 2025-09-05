import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { NxJsonConfiguration } from '../config/nx-json';
import type {
  FileData,
  FileMap,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { workspaceDataDirectory } from '../utils/cache-directory';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { nxVersion } from '../utils/versions';
import { ConfigurationSourceMaps } from './utils/project-configuration-utils';
import {
  ProjectGraphError,
  ProjectGraphErrorTypes,
  StaleProjectGraphCacheError,
} from './error-types';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { serverLogger } from '../daemon/server/logger';

export interface FileMapCache {
  version: string;
  nxVersion: string;
  pathMappings: Record<string, any>;
  nxJsonPlugins: PluginData[];
  pluginsConfig?: any;
  fileMap: FileMap;
  externalNodes?: Record<string, string>;
}

export const nxProjectGraph = join(
  workspaceDataDirectory,
  'project-graph.json'
);
export const nxFileMap = join(workspaceDataDirectory, 'file-map.json');

export const nxSourceMaps = join(workspaceDataDirectory, 'source-maps.json');

export function ensureCacheDirectory(): void {
  try {
    if (!existsSync(workspaceDataDirectory)) {
      mkdirSync(workspaceDataDirectory, { recursive: true });
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
    if (!directoryExists(workspaceDataDirectory)) {
      throw new Error(`Failed to create directory: ${workspaceDataDirectory}`);
    }
  }
}

export function readFileMapCache(): null | FileMapCache {
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

export function readProjectGraphCache(
  minimumComputedAt?: number
): null | ProjectGraph {
  performance.mark('read project-graph:start');
  ensureCacheDirectory();

  try {
    if (fileExists(nxProjectGraph)) {
      const {
        computedAt,
        errors,
        ...projectGraphCache
      }: ProjectGraph & {
        errors?: Error[];
        computedAt?: number;
      } = readJsonFile(nxProjectGraph);

      if (
        minimumComputedAt &&
        (!computedAt || computedAt < minimumComputedAt)
      ) {
        throw new StaleProjectGraphCacheError();
      }

      if (errors && errors.length > 0) {
        if (!minimumComputedAt) {
          // If you didn't pass minimum computed at, we do not know if
          // the errors on the cached graph would be relevant to what you
          // are running. Prior to adding error handling here, the graph
          // would not have been written to the cache. As such, this matches
          // existing behavior of the public API.
          return null;
        }
        throw new ProjectGraphError(
          errors,
          projectGraphCache,
          readSourceMapsCache()
        );
      }

      return projectGraphCache;
    } else {
      return null;
    }
  } catch (error) {
    if (
      error instanceof StaleProjectGraphCacheError ||
      error instanceof ProjectGraphError
    ) {
      throw error;
    }
    console.log(
      `Error reading '${nxProjectGraph}'. Continue the process without the cache.`
    );
    console.log(error);
    return null;
  } finally {
    performance.mark('read project-graph:end');
    performance.measure(
      'read cache',
      'read project-graph:start',
      'read project-graph:end'
    );
  }
}

export function readSourceMapsCache(): null | ConfigurationSourceMaps {
  performance.mark('read source-maps:start');
  ensureCacheDirectory();

  let data = null;
  try {
    if (fileExists(nxSourceMaps)) {
      data = readJsonFile(nxSourceMaps);
    }
  } catch (error) {
    console.log(
      `Error reading '${nxSourceMaps}'. Continue the process without the cache.`
    );
    console.log(error);
  }

  performance.mark('read source-maps:end');
  performance.measure(
    'read cache',
    'read source-maps:start',
    'read source-maps:end'
  );
  return data ?? null;
}

export function createProjectFileMapCache(
  nxJson: NxJsonConfiguration<'*' | string[]>,
  packageJsonDeps: Record<string, string>,
  fileMap: FileMap,
  tsConfig: { compilerOptions?: { paths?: { [p: string]: any } } },
  externalNodes: Record<string, ProjectGraphExternalNode>
) {
  const nxJsonPlugins = getNxJsonPluginsData(nxJson, packageJsonDeps);
  const externalNodesData = getExternalNodesData(externalNodes);
  const newValue: FileMapCache = {
    version: '6.0',
    nxVersion: nxVersion,
    // compilerOptions may not exist, especially for package-based repos
    pathMappings: tsConfig?.compilerOptions?.paths || {},
    nxJsonPlugins,
    pluginsConfig: nxJson?.pluginsConfig,
    fileMap,
    externalNodes: externalNodesData,
  };
  return newValue;
}

export function writeCache(
  cache: FileMapCache,
  projectGraph: ProjectGraph,
  sourceMaps: ConfigurationSourceMaps,
  errors: ProjectGraphErrorTypes[]
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
    const tmpSourceMapPath = `${nxSourceMaps}~${unique}`;

    try {
      writeJsonFile(tmpProjectGraphPath, {
        ...projectGraph,
        errors,
        computedAt: Date.now(),
      });
      renameSync(tmpProjectGraphPath, nxProjectGraph);

      writeJsonFile(tmpSourceMapPath, sourceMaps);
      renameSync(tmpSourceMapPath, nxSourceMaps);

      // only write the file map if there are no errors
      // if there were errors, the errors make the filemap invalid
      // TODO: We should be able to keep the valid part of the filemap if the errors being thrown told us which parts of the filemap were invalid
      if (errors.length === 0) {
        writeJsonFile(tmpFileMapPath, cache);
        renameSync(tmpFileMapPath, nxFileMap);
      }

      if (isOnDaemon()) {
        serverLogger.log(
          `Wrote project graph cache to ${nxProjectGraph}${
            errors.length > 0 ? ' with errors' : ''
          }`
        );
      }

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
  if (!done) {
    throw new Error(
      `Failed to write project graph cache to ${nxProjectGraph} and ${nxFileMap} after 5 attempts.`
    );
  }
  performance.mark('write cache:end');
  performance.measure('write cache', 'write cache:start', 'write cache:end');
}

export function shouldRecomputeWholeGraph(
  cache: FileMapCache,
  packageJsonDeps: Record<string, string>,
  projects: Record<string, ProjectConfiguration>,
  nxJson: NxJsonConfiguration,
  tsConfig: { compilerOptions: { paths: { [k: string]: any } } },
  externalNodes?: Record<string, ProjectGraphExternalNode>
): boolean {
  if (cache.version !== '6.0') {
    return true;
  }
  if (cache.nxVersion !== nxVersion) {
    return true;
  }

  // we have a cached project that is no longer present
  const cachedNodes = Object.keys(cache.fileMap.projectFileMap);
  if (cachedNodes.some((p) => projects[p] === undefined)) {
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
  if (
    JSON.stringify(getNxJsonPluginsData(nxJson, packageJsonDeps)) !==
    JSON.stringify(cache.nxJsonPlugins)
  ) {
    return true;
  }

  if (
    JSON.stringify(nxJson?.pluginsConfig) !==
    JSON.stringify(cache.pluginsConfig)
  ) {
    return true;
  }

  // Check if external nodes have changed
  if (
    hashExternalNodes(getExternalNodesData(externalNodes)) !==
    hashExternalNodes(cache.externalNodes)
  ) {
    return true;
  }

  return false;
}

export type CachedFileData = {
  nonProjectFiles: Record<string, FileData>;
  projectFileMap: { [project: string]: Record<string, FileData> };
};

/*
This can only be invoked when the list of projects is either the same
or new projects have been added, so every project in the cache has a corresponding
project in fileMap
*/
export function extractCachedFileData(
  fileMap: FileMap,
  c: FileMapCache
): {
  filesToProcess: FileMap;
  cachedFileData: CachedFileData;
} {
  const filesToProcess: FileMap = {
    nonProjectFiles: [],
    projectFileMap: {},
  };
  const cachedFileData: CachedFileData = {
    nonProjectFiles: {},
    projectFileMap: {},
  };

  const currentProjects = Object.keys(fileMap.projectFileMap).filter(
    (name) => fileMap.projectFileMap[name].length > 0
  );
  currentProjects.forEach((p) => {
    processProjectNode(
      p,
      c.fileMap.projectFileMap,
      cachedFileData.projectFileMap,
      filesToProcess.projectFileMap,
      fileMap
    );
  });

  processNonProjectFiles(
    c.fileMap.nonProjectFiles,
    fileMap.nonProjectFiles,
    filesToProcess.nonProjectFiles,
    cachedFileData.nonProjectFiles
  );

  return {
    filesToProcess,
    cachedFileData,
  };
}

function processNonProjectFiles(
  cachedFiles: FileData[],
  nonProjectFiles: FileData[],
  filesToProcess: FileMap['nonProjectFiles'],
  cachedFileData: CachedFileData['nonProjectFiles']
) {
  const cachedHashMap = new Map(cachedFiles.map((f) => [f.file, f]));
  for (const f of nonProjectFiles) {
    const cachedFile = cachedHashMap.get(f.file);
    if (!cachedFile || cachedFile.hash !== f.hash) {
      filesToProcess.push(f);
    } else {
      cachedFileData[f.file] = cachedFile;
    }
  }
}

function processProjectNode(
  projectName: string,
  cachedFileMap: ProjectFileMap,
  cachedFileData: { [project: string]: { [file: string]: FileData } },
  filesToProcess: ProjectFileMap,
  { projectFileMap }: FileMap
) {
  if (!cachedFileMap[projectName]) {
    filesToProcess[projectName] = projectFileMap[projectName];
    return;
  }

  const fileDataFromCache = {} as any;
  for (let f of cachedFileMap[projectName]) {
    fileDataFromCache[f.file] = f;
  }

  if (!cachedFileData[projectName]) {
    cachedFileData[projectName] = {};
  }

  for (let f of projectFileMap[projectName]) {
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

type PluginData = {
  name: string;
  version: string;
  options?: unknown;
};

function getNxJsonPluginsData(
  nxJson: NxJsonConfiguration,
  packageJsonDeps: Record<string, string>
): PluginData[] {
  return (nxJson?.plugins || []).map((p) => {
    const [plugin, options] =
      typeof p === 'string' ? [p] : [p.plugin, p.options];
    return {
      name: plugin,
      version: packageJsonDeps[plugin],
      options,
    };
  });
}

function getExternalNodesData(
  externalNodes: Record<string, ProjectGraphExternalNode>
): Record<string, string> {
  return Object.entries(externalNodes).reduce((acc, [name, node]) => {
    acc[name] = node.data.version;
    return acc;
  }, {});
}

function hashExternalNodes(
  externalNodes: Record<string, string> | undefined
): string {
  if (!externalNodes || Object.keys(externalNodes).length === 0) {
    return '';
  }

  // Sort external nodes by name for consistent hashing
  const sortedNodes = Object.entries(externalNodes).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return JSON.stringify(sortedNodes);
}
