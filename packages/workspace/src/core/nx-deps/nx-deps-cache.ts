import { FileData, filesChanged } from '../file-utils';
import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
} from '../project-graph';
import { join } from 'path';
import { appRootPath } from '../../utils/app-root';
import { existsSync } from 'fs';
import * as fsExtra from 'fs-extra';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../utils/fileutils';
import { FileMap } from '@nrwl/workspace/src/core/file-graph';

export interface ProjectGraphCache {
  version: string;
  rootFiles: FileData[];
  nodes: Record<string, ProjectGraphNode>;
  dependencies: Record<string, ProjectGraphDependency[]>;
}

const nxDepsDir = join(appRootPath, 'node_modules', '.cache', 'nx');
const nxDepsPath = join(nxDepsDir, 'nxdeps.json');
export function readCache(): false | ProjectGraphCache {
  try {
    if (!existsSync(nxDepsDir)) {
      fsExtra.ensureDirSync(nxDepsDir);
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

  const data = fileExists(nxDepsPath) ? readJsonFile(nxDepsPath) : null;
  return data ? data : false;
}

export function writeCache(
  rootFiles: FileData[],
  projectGraph: ProjectGraph
): void {
  writeJsonFile(nxDepsPath, {
    version: '2.0',
    rootFiles,
    nodes: projectGraph.nodes,
    dependencies: projectGraph.dependencies,
  });
}

export function differentFromCache(
  fileMap: FileMap,
  c: ProjectGraphCache
): {
  noDifference: boolean;
  filesDifferentFromCache: FileMap;
  partiallyConstructedProjectGraph?: ProjectGraph;
} {
  const currentProjects = Object.keys(fileMap).sort();
  const previousProjects = Object.keys(c.nodes)
    .sort()
    .filter((name) => c.nodes[name].data.files.length > 0);

  // Projects changed -> compute entire graph
  if (
    currentProjects.length !== previousProjects.length ||
    currentProjects.some((val, idx) => val !== previousProjects[idx])
  ) {
    return {
      filesDifferentFromCache: fileMap,
      partiallyConstructedProjectGraph: null,
      noDifference: false,
    };
  }

  // Projects are same -> compute projects with file changes
  const filesDifferentFromCache: FileMap = {};
  currentProjects.forEach((p) => {
    if (filesChanged(c.nodes[p].data.files, fileMap[p])) {
      filesDifferentFromCache[p] = fileMap[p];
    }
  });

  // Re-compute nodes and dependencies for each project in file map.
  Object.keys(filesDifferentFromCache).forEach((key) => {
    delete c.dependencies[key];
  });

  const partiallyConstructedProjectGraph = {
    nodes: c.nodes,
    dependencies: c.dependencies,
  };

  return {
    filesDifferentFromCache: filesDifferentFromCache,
    partiallyConstructedProjectGraph,
    noDifference: Object.keys(filesDifferentFromCache).length === 0,
  };
}
