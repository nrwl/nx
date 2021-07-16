import { FileData, filesChanged } from '../file-utils';
import type {
  NxJsonConfiguration,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { existsSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../utilities/fileutils';
import type { ProjectFileMap } from '../file-graph';
import { performance } from 'perf_hooks';
import {
  cacheDirectory,
  readCacheDirectoryProperty,
} from '../../utilities/cache-directory';

export interface ProjectGraphCache {
  version: string;
  deps: Record<string, string>;
  pathMappings: Record<string, any>;
  nxJsonPlugins: { name: string; version: string }[];
  nodes: Record<string, ProjectGraphNode>;
  dependencies: Record<string, ProjectGraphDependency[]>;
}

const nxDepsDir = cacheDirectory(
  appRootPath,
  readCacheDirectoryProperty(appRootPath)
);
const nxDepsPath = join(nxDepsDir, 'nxdeps.json');

export function readCache(): false | ProjectGraphCache {
  performance.mark('read cache:start');
  try {
    if (!existsSync(nxDepsDir)) {
      ensureDirSync(nxDepsDir);
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
    if (!directoryExists(nxDepsDir)) {
      throw new Error(`Failed to create directory: ${nxDepsDir}`);
    }
  }

  let data = null;
  try {
    if (fileExists(nxDepsPath)) {
      data = readJsonFile(nxDepsPath);
    }
  } catch (error) {
    console.log(
      `Error reading '${nxDepsPath}'. Continue the process without the cache.`
    );
    console.log(error);
  }

  performance.mark('read cache:end');
  performance.measure('read cache', 'read cache:start', 'read cache:end');
  return data ?? false;
}

export function writeCache(
  packageJsonDeps: Record<string, string>,
  nxJson: NxJsonConfiguration,
  tsConfig: { compilerOptions: { paths: { [k: string]: any } } },
  projectGraph: ProjectGraph
): void {
  performance.mark('write cache:start');
  const nxJsonPlugins = (nxJson.plugins || []).map((p) => ({
    name: p,
    version: packageJsonDeps[p],
  }));
  const newValue: ProjectGraphCache = {
    version: '3.0',
    deps: packageJsonDeps,
    pathMappings: tsConfig.compilerOptions.paths,
    nxJsonPlugins,
    nodes: projectGraph.nodes,
    dependencies: projectGraph.dependencies,
  };
  writeJsonFile(nxDepsPath, newValue);
  performance.mark('write cache:end');
  performance.measure('write cache', 'write cache:start', 'write cache:end');
}

export function shouldRecomputeWholeGraph(
  cache: ProjectGraphCache,
  packageJsonDeps: Record<string, string>,
  workspaceJson: WorkspaceJsonConfiguration,
  nxJson: NxJsonConfiguration,
  tsConfig: { compilerOptions: { paths: { [k: string]: any } } }
): boolean {
  if (cache.deps['@nrwl/workspace'] !== packageJsonDeps['@nrwl/workspace']) {
    return true;
  }

  // we have a cached project that is no longer present
  if (
    Object.keys(cache.nodes).some(
      (p) =>
        cache.nodes[p].type != 'app' &&
        cache.nodes[p].type != 'lib' &&
        !workspaceJson.projects[p]
    )
  ) {
    return true;
  }

  // a path mapping for an existing project has changed
  if (
    Object.keys(cache.pathMappings).some(
      (t) =>
        JSON.stringify(cache.pathMappings[t]) !=
        JSON.stringify(tsConfig.compilerOptions.paths[t])
    )
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

  return false;
}

/*
This can only be invoked when the list of projects is either the same
or new projects have been added, so every project in the cache has a corresponding
project in fileMap
*/
export function extractCachedPartOfProjectGraph(
  fileMap: ProjectFileMap,
  nxJson: NxJsonConfiguration,
  c: ProjectGraphCache
): {
  filesDifferentFromCache: ProjectFileMap;
  cachedPartOfProjectGraph: ProjectGraph;
} {
  const currentProjects = Object.keys(fileMap).filter(
    (name) => fileMap[name].length > 0
  );

  const filesDifferentFromCache: ProjectFileMap = {};
  // Re-compute nodes and dependencies for projects whose files changed
  currentProjects.forEach((p) => {
    if (!c.nodes[p] || filesChanged(c.nodes[p].data.files, fileMap[p])) {
      filesDifferentFromCache[p] = fileMap[p];
      delete c.dependencies[p];
      delete c.nodes[p];
    }
  });

  // Re-compute nodes and dependencies for projects whose implicit deps changed
  Object.keys(nxJson.projects || {}).forEach((p) => {
    if (
      nxJson.projects[p]?.implicitDependencies &&
      JSON.stringify(c.nodes[p].data.implicitDependencies) !==
        JSON.stringify(nxJson.projects[p].implicitDependencies)
    ) {
      filesDifferentFromCache[p] = fileMap[p];
      delete c.dependencies[p];
      delete c.nodes[p];
    }
  });

  return {
    filesDifferentFromCache,
    cachedPartOfProjectGraph: {
      nodes: c.nodes,
      dependencies: c.dependencies,
    },
  };
}
