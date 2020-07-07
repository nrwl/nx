import { mkdirSync } from 'fs';
import { appRootPath } from '../../utils/app-root';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../utils/fileutils';
import { assertWorkspaceValidity } from '../assert-workspace-validity';
import { createFileMap, FileMap } from '../file-graph';
import {
  defaultFileRead,
  FileData,
  mtime,
  readNxJson,
  readWorkspaceFiles,
  readWorkspaceJson,
} from '../file-utils';
import { normalizeNxJson } from '../normalize-nx-json';
import {
  BuildDependencies,
  buildExplicitNpmDependencies,
  buildExplicitTypeScriptDependencies,
  buildImplicitProjectDependencies,
} from './build-dependencies';
import {
  BuildNodes,
  buildNpmPackageNodes,
  buildWorkspaceProjectNodes,
} from './build-nodes';
import { ProjectGraphBuilder } from './project-graph-builder';
import { ProjectGraph } from './project-graph-models';

/**
 * This version is stored in the project graph cache to determine if it can be reused.
 */
const projectGraphCacheVersion = '1';

export function createProjectGraph(
  workspaceJson = readWorkspaceJson(),
  nxJson = readNxJson(),
  workspaceFiles = readWorkspaceFiles(),
  fileRead: (s: string) => string = defaultFileRead,
  cache: false | { data: ProjectGraphCache; mtime: number } = readCache(),
  shouldCache: boolean = true
): ProjectGraph {
  assertWorkspaceValidity(workspaceJson, nxJson);

  const normalizedNxJson = normalizeNxJson(nxJson);
  if (cache && maxMTime(rootWorkspaceFileData(workspaceFiles)) > cache.mtime) {
    cache = false;
  }

  if (!cache || maxMTime(workspaceFiles) > cache.mtime) {
    const fileMap = createFileMap(workspaceJson, workspaceFiles);
    const incremental = modifiedSinceCache(fileMap, cache);
    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: incremental.fileMap,
    };
    const builder = new ProjectGraphBuilder(incremental.projectGraph);
    const buildNodesFns: BuildNodes[] = [
      buildWorkspaceProjectNodes,
      buildNpmPackageNodes,
    ];
    const buildDependenciesFns: BuildDependencies[] = [
      buildExplicitTypeScriptDependencies,
      buildImplicitProjectDependencies,
      buildExplicitNpmDependencies,
    ];

    buildNodesFns.forEach((f) =>
      f(ctx, builder.addNode.bind(builder), fileRead)
    );

    buildDependenciesFns.forEach((f) =>
      f(ctx, builder.nodes, builder.addDependency.bind(builder), fileRead)
    );

    const projectGraph = builder.build();
    if (shouldCache) {
      writeCache({
        version: projectGraphCacheVersion,
        projectGraph,
        fileMap,
      });
    }
    return projectGraph;
  } else {
    // Cache file was modified _after_ all workspace files.
    // Safe to return the cached graph.
    return cache.data.projectGraph;
  }
}

// -----------------------------------------------------------------------------

interface ProjectGraphCache {
  version: string;
  projectGraph: ProjectGraph;
  fileMap: FileMap;
}

const distPath = `${appRootPath}/dist`;
const nxDepsPath = `${distPath}/nxdeps.json`;

function readCache(): false | { data: ProjectGraphCache; mtime: number } {
  try {
    mkdirSync(distPath);
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
    if (!directoryExists(distPath)) {
      throw new Error(`Failed to create directory: ${distPath}`);
    }
  }

  const data = getValidCache(
    fileExists(nxDepsPath) ? readJsonFile(nxDepsPath) : null
  );

  return data ? { data, mtime: mtime(nxDepsPath) } : false;
}

function getValidCache(cache: ProjectGraphCache | null) {
  if (!cache) {
    return null;
  }
  if (
    cache.projectGraph &&
    cache.fileMap &&
    cache.version &&
    cache.version === projectGraphCacheVersion
  ) {
    return cache;
  } else {
    return null;
  }
}

function writeCache(cache: ProjectGraphCache): void {
  writeJsonFile(nxDepsPath, cache);
}

function maxMTime(files: FileData[]) {
  return Math.max(...files.map((f) => f.mtime));
}

function rootWorkspaceFileData(workspaceFiles: FileData[]): FileData[] {
  return [
    `package.json`,
    'workspace.json',
    'angular.json',
    `nx.json`,
    `tsconfig.base.json`,
  ].reduce((acc: FileData[], curr: string) => {
    const fileData = workspaceFiles.find((x) => x.file === curr);
    if (fileData) {
      acc.push(fileData);
    }
    return acc;
  }, []);
}

function modifiedSinceCache(
  fileMap: FileMap,
  c: false | { data: ProjectGraphCache; mtime: number }
): { fileMap: FileMap; projectGraph?: ProjectGraph } {
  // No cache -> compute entire graph
  if (!c) {
    return { fileMap };
  }

  const cachedFileMap = c.data.fileMap;
  const currentProjects = Object.keys(fileMap).sort();
  const previousProjects = Object.keys(cachedFileMap).sort();

  // Projects changed -> compute entire graph
  if (
    currentProjects.length !== previousProjects.length ||
    currentProjects.some((val, idx) => val !== previousProjects[idx])
  ) {
    return { fileMap };
  }

  // Projects are same -> compute projects with file changes
  const modifiedSince: FileMap = {};
  currentProjects.forEach((p) => {
    let projectFilesChanged = false;
    for (const f of fileMap[p]) {
      const fromCache = cachedFileMap[p].find((x) => x.file === f.file);
      if (!fromCache || f.mtime > fromCache.mtime) {
        projectFilesChanged = true;
        break;
      }
    }
    if (projectFilesChanged) {
      modifiedSince[p] = fileMap[p];
    }
  });

  // Re-compute nodes and dependencies for each project in file map.
  Object.keys(modifiedSince).forEach((key) => {
    delete c.data.projectGraph.dependencies[key];
  });

  return { fileMap: modifiedSince, projectGraph: c.data.projectGraph };
}
