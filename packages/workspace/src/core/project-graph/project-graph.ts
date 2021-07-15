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
  extractCachedPartOfProjectGraph,
  ProjectGraphCache,
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
  if (
    cache &&
    cache.version === '3.0' &&
    !shouldRecomputeWholeGraph(
      cache,
      packageJsonDeps,
      workspaceJson,
      normalizedNxJson,
      rootTsConfig
    )
  ) {
    const diff = extractCachedPartOfProjectGraph(projectFileMap, nxJson, cache);
    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: diff.filesDifferentFromCache,
    };
    const projectGraph = buildProjectGraph(ctx, diff.cachedPartOfProjectGraph);
    if (cacheEnabled) {
      writeCache(packageJsonDeps, nxJson, rootTsConfig, projectGraph);
    }
    return addWorkspaceFiles(projectGraph, workspaceFiles);
  } else {
    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: projectFileMap,
    };
    const projectGraph = buildProjectGraph(ctx, null);
    if (cacheEnabled) {
      writeCache(packageJsonDeps, nxJson, rootTsConfig, projectGraph);
    }
    return addWorkspaceFiles(projectGraph, workspaceFiles);
  }
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

type BuilderContext = {
  nxJson: NxJsonConfiguration<string[]>;
  workspaceJson: WorkspaceJsonConfiguration;
  fileMap: ProjectFileMap;
};

function buildProjectGraph(ctx: BuilderContext, projectGraph: ProjectGraph) {
  performance.mark('build project graph:start');

  const builder = new ProjectGraphBuilder(projectGraph);
  const addNode = builder.addNode.bind(builder);
  const addDependency = builder.addDependency.bind(builder);
  buildWorkspaceProjectNodes(ctx, addNode);
  buildNpmPackageNodes(ctx, addNode);
  buildExplicitTypeScriptDependencies(ctx, builder.nodes, addDependency);
  buildExplicitPackageJsonDependencies(ctx, builder.nodes, addDependency);
  buildImplicitProjectDependencies(ctx, builder.nodes, addDependency);
  const initProjectGraph = builder.getProjectGraph();

  const r = updateProjectGraphWithPlugins(ctx, initProjectGraph);

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );

  return r;
}

function updateProjectGraphWithPlugins(
  ctx: BuilderContext,
  initProjectGraph: ProjectGraph
) {
  const plugins = (ctx.nxJson.plugins || []).map((path) => {
    const pluginPath = require.resolve(path, {
      paths: [appRootPath],
    });
    return require(pluginPath) as NxPlugin;
  });

  const projects = Object.keys(ctx.workspaceJson.projects).reduce(
    (map, projectName) => {
      map[projectName] = {
        ...ctx.workspaceJson.projects[projectName],
        ...ctx.nxJson.projects[projectName],
      };
      return map;
    },
    {} as Record<string, ProjectConfiguration & NxJsonProjectConfiguration>
  );
  const context: ProjectGraphProcessorContext = {
    workspace: {
      ...ctx.workspaceJson,
      ...ctx.nxJson,
      projects,
    },
    fileMap: ctx.fileMap,
  };

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
