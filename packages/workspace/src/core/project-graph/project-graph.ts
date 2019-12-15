import { mkdirSync, readFileSync } from 'fs';
import { ProjectGraph, ProjectGraphContext } from './project-graph-models';
import { ProjectGraphBuilder } from './project-graph-builder';
import { appRootPath } from '../../utils/app-root';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile
} from '../../utils/fileutils';
import {
  FileData,
  mtime,
  readNxJson,
  readWorkspaceFiles,
  readWorkspaceJson
} from '../file-utils';
import { createFileMap, FileMap } from '../file-graph';
import { BuildNodes, buildWorkspaceProjectNodes } from './build-nodes';
import {
  BuildDependencies,
  buildExplicitTypeScriptDependencies,
  buildImplicitProjectDependencies
} from './build-dependencies';
import { assertWorkspaceValidity } from '../assert-workspace-validity';

export function createProjectGraph(
  workspaceJson = readWorkspaceJson(),
  nxJson = readNxJson(),
  workspaceFiles = readWorkspaceFiles(),
  fileRead: (s: string) => string = defaultFileRead,
  cache: false | { data: ProjectGraphCache; mtime: number } = readCache()
): ProjectGraph {
  assertWorkspaceValidity(workspaceJson, nxJson);

  if (!cache || maxMTime(workspaceFiles) > cache.mtime) {
    const builder = new ProjectGraphBuilder(
      cache ? cache.data.projectGraph : undefined
    );
    const buildNodesFns: BuildNodes[] = [buildWorkspaceProjectNodes];
    const buildDependenciesFns: BuildDependencies[] = [
      buildExplicitTypeScriptDependencies,
      buildImplicitProjectDependencies
    ];
    // TODO: File graph needs to be handled separately from project graph, or
    // we need a way to support project extensions (e.g. npm project).
    const fileMap = createFileMap(workspaceJson, workspaceFiles);
    const ctx = {
      workspaceJson,
      nxJson,
      fileMap: modifiedSinceCache(fileMap, cache)
    };

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

function defaultFileRead(filePath: string) {
  return readFileSync(`${appRootPath}/${filePath}`, 'UTF-8');
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
): FileMap {
  // No cache -> compute entire graph
  if (!c) {
    return fileMap;
  }

  const currentProjects = Object.keys(fileMap).sort();
  const previousProjects = Object.keys(c.data.fileMap).sort();

  // Projects changed -> compute entire graph
  if (
    currentProjects.length !== previousProjects.length ||
    currentProjects.some((val, idx) => val !== previousProjects[idx])
  ) {
    return fileMap;
  }

  // Projects are same, only compute changed projects
  const modifiedSince: FileMap = currentProjects.reduce((acc, k) => {
    acc[k] = [];
    return acc;
  }, {});
  currentProjects.forEach(p => {
    for (const f of fileMap[p]) {
      const fromCache = c.data.fileMap[p].find(x => x.file === f.file);

      if (!fromCache) {
        modifiedSince[p].push(f);
      } else if (f.mtime > fromCache.mtime) {
        modifiedSince[p].push(f);
      }
    }
  });
  return modifiedSince;
}
