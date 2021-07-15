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
import { ProjectGraphBuilder } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { performance } from 'perf_hooks';
import { assertWorkspaceValidity } from '../assert-workspace-validity';
import { createProjectFileMap } from '../file-graph';
import {
  filesChanged,
  readNxJson,
  readWorkspaceFiles,
  readWorkspaceJson,
  rootWorkspaceFileData,
} from '../file-utils';
import { normalizeNxJson } from '../normalize-nx-json';
import {
  differentFromCache,
  ProjectGraphCache,
  readCache,
  writeCache,
} from '../nx-deps/nx-deps-cache';
import {
  BuildDependencies,
  buildExplicitPackageJsonDependencies,
  buildExplicitTypeScriptDependencies,
  buildImplicitProjectDependencies,
} from './build-dependencies';
import {
  BuildNodes,
  buildNpmPackageNodes,
  buildWorkspaceProjectNodes,
} from './build-nodes';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(): ProjectGraphCache {
  const cachedProjectGraph = readCache();
  if (!cachedProjectGraph) {
    throw new Error(`
      [readCachedProjectGraph] ERROR: No cached ProjectGraph is available.
      
      If you are leveraging \`readCachedProjectGraph()\` directly then you will need to refactor your usage to first ensure that
      the ProjectGraph is created by calling \`await createProjectGraphAsync()\` somewhere before attempting to read the data.

      If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
    `);
  }
  return cachedProjectGraph;
}

export async function createProjectGraphAsync(): Promise<ProjectGraph> {
  return createProjectGraph();
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

  const rootFiles = rootWorkspaceFileData();
  const projectFileMap = createProjectFileMap(workspaceJson, workspaceFiles);

  if (cache && !filesChanged(rootFiles, cache.rootFiles)) {
    const diff = differentFromCache(projectFileMap, cache);
    if (diff.noDifference) {
      return addWorkspaceFiles(
        diff.partiallyConstructedProjectGraph,
        workspaceFiles
      );
    }

    const ctx = {
      workspaceJson,
      nxJson: normalizedNxJson,
      fileMap: diff.filesDifferentFromCache,
    };
    const projectGraph = buildProjectGraph(
      ctx,
      diff.partiallyConstructedProjectGraph
    );
    if (cacheEnabled) {
      writeCache(rootFiles, projectGraph);
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
      writeCache(rootFiles, projectGraph);
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

function buildProjectGraph(
  ctx: {
    nxJson: NxJsonConfiguration<string[]>;
    workspaceJson: WorkspaceJsonConfiguration;
    fileMap: ProjectFileMap;
  },
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
    buildExplicitPackageJsonDependencies,
  ];
  buildNodesFns.forEach((f) => f(ctx, builder.addNode.bind(builder)));
  buildDependenciesFns.forEach((f) =>
    f(ctx, builder.nodes, builder.addDependency.bind(builder))
  );
  const r = builder.getProjectGraph();

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

  const result = plugins.reduce((graph, plugin) => {
    if (!plugin.processProjectGraph) {
      return graph;
    }

    return plugin.processProjectGraph(graph, context);
  }, r);

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );
  return result;
}
