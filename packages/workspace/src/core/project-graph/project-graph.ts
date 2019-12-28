import { mkdirSync, readFileSync } from 'fs';
import { ProjectGraph } from './project-graph-models';
import { ProjectGraphBuilder } from './project-graph-builder';
import { appRootPath } from '../../utils/app-root';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile
} from '../../utils/fileutils';
import {
  defaultFileRead,
  FileData,
  mtime,
  readNxJson,
  readWorkspaceFiles,
  readWorkspaceJson
} from '../file-utils';
import { createFileMap, FileMap } from '../file-graph';
import {
  BuildNodes,
  buildNpmPackageNodes,
  buildWorkspaceProjectNodes
} from './build-nodes';
import {
  BuildDependencies,
  buildExplicitNpmDependencies,
  buildExplicitTypeScriptDependencies,
  buildImplicitProjectDependencies
} from './build-dependencies';
import { assertWorkspaceValidity } from '../assert-workspace-validity';
import { normalizeNxJson } from '../normalize-nx-json';

export function createProjectGraph(
  workspaceJson = readWorkspaceJson(),
  nxJson = readNxJson(),
  workspaceFiles = readWorkspaceFiles(),
  fileRead: (s: string) => string = defaultFileRead,
  cache: false | { data: ProjectGraphCache; mtime: number } = readCache()
): ProjectGraph {
  assertWorkspaceValidity(workspaceJson, nxJson);

  const normalizedNxJson = normalizeNxJson(nxJson);

  if (!cache || maxMTime(workspaceFiles) > cache.mtime) {
    const fileMap = createFileMap(workspaceJson, workspaceFiles);
    const incremental = modifiedSinceCache(fileMap, cache);
    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: incremental.fileMap
    };
    const builder = new ProjectGraphBuilder(incremental.projectGraph);
    const buildNodesFns: BuildNodes[] = [
      buildWorkspaceProjectNodes,
      buildNpmPackageNodes
    ];
    const buildDependenciesFns: BuildDependencies[] = [
      buildExplicitTypeScriptDependencies,
      buildImplicitProjectDependencies,
      buildExplicitNpmDependencies
    ];

    buildNodesFns.forEach(f => f(ctx, builder.addNode.bind(builder), fileRead));

    buildDependenciesFns.forEach(f =>
      f(ctx, builder.nodes, builder.addDependency.bind(builder), fileRead)
    );

    const projectGraph = builder.build();
    writeCache({
      projectGraph,
      fileMap
    });
    return projectGraph;
  } else {
    // Cache file was modified _after_ all workspace files.
    // Safe to return the cached graph.
    return cache.data.projectGraph;
  }
}

// -----------------------------------------------------------------------------

interface ProjectGraphCache {
  projectGraph: ProjectGraph;
  fileMap: FileMap;
}

const nxDepsPath = `${appRootPath}/dist/nxdeps.json`;

function readCache(): false | { data: ProjectGraphCache; mtime: number } {
  if (!directoryExists(`${appRootPath}/dist`)) {
    mkdirSync(`${appRootPath}/dist`);
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
  return cache.projectGraph && cache.fileMap ? cache : null;
}

function writeCache(cache: ProjectGraphCache): void {
  writeJsonFile(nxDepsPath, cache);
}

function maxMTime(files: FileData[]) {
  return Math.max(...files.map(f => f.mtime));
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
  currentProjects.forEach(p => {
    let projectFilesChanged = false;
    for (const f of fileMap[p]) {
      const fromCache = cachedFileMap[p].find(x => x.file === f.file);
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
  Object.keys(modifiedSince).forEach(key => {
    delete c.data.projectGraph.dependencies[key];
  });

  return { fileMap: modifiedSince, projectGraph: c.data.projectGraph };
}
