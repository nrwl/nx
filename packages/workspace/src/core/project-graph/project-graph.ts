import type {
  FileData,
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
  NxPlugin,
  ProjectConfiguration,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProcessorContext,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { ProjectGraphBuilder, readJsonFile } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { assertWorkspaceValidity } from '../assert-workspace-validity';
import { createProjectFileMap } from '../file-graph';
import {
  readNxJson,
  readWorkspaceFiles,
  readWorkspaceJson,
} from '../file-utils';
import { normalizeNxJson } from '../normalize-nx-json';
import {
  extractCachedFileData,
  readCache,
  shouldRecomputeWholeGraph,
  writeCache,
} from '../nx-deps/nx-deps-cache';
import {
  buildExplicitPackageJsonDependencies,
  buildExplicitTypeScriptDependencies,
  buildImplicitProjectDependencies,
} from './build-dependencies';
import {
  buildNpmPackageNodes,
  buildWorkspaceProjectNodes,
} from './build-nodes';

export async function createProjectGraphAsync(): Promise<ProjectGraph> {
  return createProjectGraph();
}

function readCombinedDeps() {
  const json = readJsonFile(join(appRootPath, 'package.json'));
  return { ...json.dependencies, ...json.devDependencies };
}

// TODO(v13): remove this deprecated function
/**
 * @deprecated This function is deprecated in favor of the new asynchronous version {@link createProjectGraphAsync}
 */
export function createProjectGraph(
  workspaceJson = readWorkspaceJson(),
  nxJson = readNxJson(),
  workspaceFiles = readWorkspaceFiles()
): ProjectGraph {
  const cacheEnabled = process.env.NX_CACHE_PROJECT_GRAPH !== 'false';
  let cache = cacheEnabled ? readCache() : false;
  assertWorkspaceValidity(workspaceJson, nxJson);
  const normalizedNxJson = normalizeNxJson(nxJson);
  const projectFileMap = createProjectFileMap(workspaceJson, workspaceFiles);
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();

  let filesToProcess = projectFileMap;
  let cachedFileData = {};
  if (
    cache &&
    cache.version === '3.0' &&
    !shouldRecomputeWholeGraph(
      cache,
      packageJsonDeps,
      workspaceJson,
      normalizedNxJson,
      rootTsConfig
    ) &&
    cacheEnabled
  ) {
    const fromCache = extractCachedFileData(projectFileMap, cache);
    filesToProcess = fromCache.filesToProcess;
    cachedFileData = fromCache.cachedFileData;
  }
  const context = createContext(
    workspaceJson,
    normalizedNxJson,
    projectFileMap,
    filesToProcess
  );
  const projectGraph = buildProjectGraph(context, cachedFileData);
  if (cacheEnabled) {
    writeCache(packageJsonDeps, nxJson, rootTsConfig, projectGraph);
  }
  return addWorkspaceFiles(projectGraph, workspaceFiles);
}

export function readCurrentProjectGraph(): ProjectGraph | null {
  const cache = readCache();
  return cache === false ? null : cache;
}

function addWorkspaceFiles(
  projectGraph: ProjectGraph,
  allWorkspaceFiles: FileData[]
) {
  return { ...projectGraph, allWorkspaceFiles };
}

function buildProjectGraph(
  ctx: ProjectGraphProcessorContext,
  cachedFileData: { [project: string]: { [file: string]: FileData } }
) {
  performance.mark('build project graph:start');

  const builder = new ProjectGraphBuilder();

  buildWorkspaceProjectNodes(ctx, builder);
  buildNpmPackageNodes(builder);
  for (const proj of Object.keys(cachedFileData)) {
    for (const f of builder.graph.nodes[proj].data.files) {
      const cached = cachedFileData[proj][f.file];
      if (cached) {
        f.deps = cached.deps;
      }
    }
  }

  buildExplicitTypeScriptDependencies(ctx, builder);
  buildExplicitPackageJsonDependencies(ctx, builder);
  buildImplicitProjectDependencies(ctx, builder);
  const initProjectGraph = builder.getUpdatedProjectGraph();

  const r = updateProjectGraphWithPlugins(ctx, initProjectGraph);

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );

  return r;
}

function createContext(
  workspaceJson: WorkspaceJsonConfiguration,
  nxJson: NxJsonConfiguration,
  fileMap: ProjectFileMap,
  filesToProcess: ProjectFileMap
): ProjectGraphProcessorContext {
  const projects = Object.keys(workspaceJson.projects).reduce(
    (map, projectName) => {
      map[projectName] = {
        ...workspaceJson.projects[projectName],
        ...nxJson.projects[projectName],
      };
      return map;
    },
    {} as Record<string, ProjectConfiguration & NxJsonProjectConfiguration>
  );
  return {
    workspace: {
      ...workspaceJson,
      ...nxJson,
      projects,
    },
    fileMap,
    filesToProcess,
  };
}

function updateProjectGraphWithPlugins(
  context: ProjectGraphProcessorContext,
  initProjectGraph: ProjectGraph
) {
  const plugins = (context.workspace.plugins || []).map((path) => {
    const pluginPath = require.resolve(path, {
      paths: [appRootPath],
    });
    return require(pluginPath) as NxPlugin;
  });

  return plugins.reduce((graph, plugin) => {
    if (!plugin.processProjectGraph) {
      return graph;
    }
    return plugin.processProjectGraph(graph, context);
  }, initProjectGraph);
}

function readRootTsConfig() {
  try {
    return readJsonFile(join(appRootPath, 'tsconfig.base.json'));
  } catch (e) {
    return readJsonFile(join(appRootPath, 'tsconfig.json'));
  }
}
