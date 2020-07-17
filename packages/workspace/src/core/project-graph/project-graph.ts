import { assertWorkspaceValidity } from '../assert-workspace-validity';
import { createFileMap, FileMap } from '../file-graph';
import {
  defaultFileRead,
  filesChanged,
  readNxJson,
  readWorkspaceFiles,
  readWorkspaceJson,
  rootWorkspaceFileData,
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
import {
  differentFromCache,
  ProjectGraphCache,
  readCache,
  writeCache,
} from '../nx-deps/nx-deps-cache';
import { NxJson } from '../shared-interfaces';
import { performance } from 'perf_hooks';

export function createProjectGraph(
  workspaceJson = readWorkspaceJson(),
  nxJson = readNxJson(),
  workspaceFiles = readWorkspaceFiles(),
  fileRead: (s: string) => string = defaultFileRead,
  cache: false | ProjectGraphCache = readCache(),
  shouldCache: boolean = true
): ProjectGraph {
  assertWorkspaceValidity(workspaceJson, nxJson);
  const normalizedNxJson = normalizeNxJson(nxJson);

  const rootFiles = rootWorkspaceFileData();
  const fileMap = createFileMap(workspaceJson, workspaceFiles);

  if (cache && !filesChanged(rootFiles, cache.rootFiles)) {
    const diff = differentFromCache(fileMap, cache);
    if (diff.noDifference) {
      return diff.partiallyConstructedProjectGraph;
    }

    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: diff.filesDifferentFromCache,
    };
    const projectGraph = buildProjectGraph(
      ctx,
      fileRead,
      diff.partiallyConstructedProjectGraph
    );
    if (shouldCache) {
      writeCache(rootFiles, projectGraph);
    }
    return projectGraph;
  } else {
    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: fileMap,
    };
    const projectGraph = buildProjectGraph(ctx, fileRead, null);
    if (shouldCache) {
      writeCache(rootFiles, projectGraph);
    }
    return projectGraph;
  }
}

function buildProjectGraph(
  ctx: { nxJson: NxJson<string[]>; workspaceJson: any; fileMap: FileMap },
  fileRead: (s: string) => string,
  projectGraph: ProjectGraph
) {
  performance.mark('build project graph:start');
  const builder = new ProjectGraphBuilder(projectGraph);
  const buildNodesFns: BuildNodes[] = [
    buildWorkspaceProjectNodes,
    buildNpmPackageNodes,
  ];
  const buildDependenciesFns: BuildDependencies[] = [
    buildExplicitTypeScriptDependencies,
    buildImplicitProjectDependencies,
    buildExplicitNpmDependencies,
  ];
  buildNodesFns.forEach((f) => f(ctx, builder.addNode.bind(builder), fileRead));
  buildDependenciesFns.forEach((f) =>
    f(ctx, builder.nodes, builder.addDependency.bind(builder), fileRead)
  );
  const r = builder.build();
  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );
  return r;
}
