import {
  FileData,
  logger,
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
  NxPlugin,
  ProjectConfiguration,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphNode,
  ProjectGraphProcessorContext,
  readJsonFile,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { extname, join } from 'path';
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
import { existsSync } from 'fs';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from

 * @param {string} projectGraphVersion Version to map ProjectGraph to
 * @returns {ProjectGraph}
 */
export function readCachedProjectGraph(
  projectGraphVersion = '3.0'
): ProjectGraph {
  const projectGraphCache: ProjectGraphCache | false = readCache();
  if (!projectGraphCache) {
    throw new Error(`
      [readCachedProjectGraph] ERROR: No cached ProjectGraph is available.

      If you are leveraging \`readCachedProjectGraph()\` directly then you will need to refactor your usage to first ensure that
      the ProjectGraph is created by calling \`await createProjectGraphAsync()\` somewhere before attempting to read the data.

      If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
    `);
  }
  let projectGraph: ProjectGraph = {
    version: projectGraphCache.version,
    nodes: projectGraphCache.nodes,
    dependencies: projectGraphCache.dependencies,
  };
  if (projectGraphVersion !== projectGraph.version) {
    projectGraph =
      projectGraphVersion === '3.0'
        ? projectGraphCompat4to3(projectGraph)
        : projectGraphMigrate3to4(projectGraph);
  }
  return projectGraph;
}

/**
 * Migrate project graph from v3 to v4
 * @param {ProjectGraph} projectGraph
 */
export function projectGraphMigrate3to4(
  projectGraph: ProjectGraph
): ProjectGraph {
  const nodes: Record<string, ProjectGraphNode> = {};
  Object.entries(projectGraph.nodes).forEach(([name, node]) => {
    const files = node.data.files.map(({ file, hash, deps }) => ({
      file,
      hash,
      ...(deps && { deps }),
    }));
    nodes[name] = {
      ...node,
      data: {
        ...node.data,
        files,
      },
    };
  });

  return {
    ...projectGraph,
    nodes,
    version: '4.0',
  };
}

/**
 * Backwards compatibility adapter for project Nodes
 * @param {ProjectGraph} projectGraph
 * @returns {ProjectGraph}
 */
export function projectGraphCompat4to3(
  projectGraph: ProjectGraph
): ProjectGraph {
  const nodes: Record<string, ProjectGraphNode> = {};
  Object.entries(projectGraph.nodes).forEach(([name, node]) => {
    const files = node.data.files.map(({ file, hash, ext, deps }) => ({
      file,
      hash,
      ext: ext || extname(file),
      ...(deps && { deps }),
    }));
    nodes[name] = {
      ...node,
      data: {
        ...node.data,
        files,
      },
    };
  });

  return {
    ...projectGraph,
    nodes,
    version: '3.0',
  };
}

/**
 * Backwards compatibility adapter for FileData
 * @param {FileData} fileData
 * @param {string?} projectGraphVersion
 * @returns
 */
export function projectFileDataCompatAdapter(
  fileData: FileData,
  projectGraphVersion: string
): FileData {
  const { file, hash, ext, deps } = fileData;
  if (projectGraphVersion !== '3.0') {
    return { file, hash, ...{ deps } };
  } else {
    return { file, hash, ext: ext || extname(file), ...{ deps } };
  }
}

export async function createProjectGraphAsync(
  projectGraphVersion = '3.0'
): Promise<ProjectGraph> {
  /**
   * Using the daemon is currently an undocumented, opt-in feature while we build out its capabilities.
   * If the environment variable is not set to true, fallback to using the existing in-process logic.
   */
  if (process.env.NX_DAEMON !== 'true') {
    return createProjectGraph(
      undefined,
      undefined,
      undefined,
      projectGraphVersion
    );
  }

  const daemonClient = require('./daemon/client/client');
  if (!(await daemonClient.isServerAvailable())) {
    logger.warn(
      '\nWARNING: You set NX_DAEMON=true but the Daemon Server is not running. Starting Daemon Server in the background...'
    );
    await daemonClient.startInBackground();
  }

  return daemonClient.getProjectGraphFromServer();
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
  workspaceJson?: WorkspaceJsonConfiguration,
  nxJson?: NxJsonConfiguration,
  workspaceFiles?: FileData[],
  projectGraphVersion?: string
): ProjectGraph {
  projectGraphVersion = projectGraphVersion || '3.0';
  workspaceJson = workspaceJson || readWorkspaceJson();
  nxJson = nxJson || readNxJson();
  workspaceFiles = workspaceFiles || readWorkspaceFiles(projectGraphVersion);

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
    (cache.version === '3.0' || cache.version === '4.0') &&
    !shouldRecomputeWholeGraph(
      cache,
      packageJsonDeps,
      workspaceJson,
      normalizedNxJson,
      rootTsConfig
    )
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
  let projectGraph = buildProjectGraph(
    context,
    cachedFileData,
    projectGraphVersion
  );
  if (cache && cache.version && projectGraphVersion !== cache.version) {
    projectGraph =
      projectGraphVersion === '3.0'
        ? projectGraphCompat4to3(projectGraph)
        : projectGraphMigrate3to4(projectGraph);
  }
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
  cachedFileData: { [project: string]: { [file: string]: FileData } },
  projectGraphVersion: string
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
  builder.setVersion(projectGraphVersion);
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
  const projects: Record<
    string,
    ProjectConfiguration & NxJsonProjectConfiguration
  > = Object.keys(workspaceJson.projects).reduce((map, projectName) => {
    map[projectName] = {
      ...workspaceJson.projects[projectName],
      ...nxJson.projects[projectName],
    };
    return map;
  }, {});
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
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(appRootPath, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return readJsonFile(tsConfigPath);
    }
  }
}
