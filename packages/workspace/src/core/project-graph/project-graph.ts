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
import { ProjectGraphBuilder, readJsonFile, logger } from '@nrwl/devkit';
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
  ProjectGraphCache,
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

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(): ProjectGraph {
  const projectGraphCache: ProjectGraphCache | false = readCache();
  if (!projectGraphCache) {
    throw new Error(`
      [readCachedProjectGraph] ERROR: No cached ProjectGraph is available.

      If you are leveraging \`readCachedProjectGraph()\` directly then you will need to refactor your usage to first ensure that
      the ProjectGraph is created by calling \`await createProjectGraphAsync()\` somewhere before attempting to read the data.

      If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
    `);
  }
  return {
    nodes: projectGraphCache.nodes,
    dependencies: projectGraphCache.dependencies,
  };
}

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

// TODO(v13): remove this deprecated function
/**
 * @deprecated This function is deprecated in favor of {@link readCachedProjectGraph}
 */
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
  return (context.workspace.plugins || []).reduce((graph, path) => {
    try {
      const pluginPath = require.resolve(path, {
        paths: [appRootPath],
      });

      const pluginModule = require(pluginPath) as NxPlugin;

      if (!pluginModule.processProjectGraph) {
        return graph;
      }

      return pluginModule.processProjectGraph(graph, context);
    } catch (e) {
      const message = `Failed to process the project graph with "${path}". This will error in the future!`;
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(e);
        logger.error(message);
        return graph;
      } else {
        logger.warn(message);
        logger.warn(`Run with NX_VERBOSE_LOGGING=true to see the error.`);
      }
      return graph;
    }
  }, initProjectGraph);
}

function readRootTsConfig() {
  try {
    return readJsonFile(join(appRootPath, 'tsconfig.base.json'));
  } catch (e) {
    return readJsonFile(join(appRootPath, 'tsconfig.json'));
  }
}
