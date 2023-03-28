import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { assertWorkspaceValidity } from '../utils/assert-workspace-validity';
import { FileData } from './file-utils';
import {
  createCache,
  extractCachedFileData,
  ProjectGraphCache,
  readCache,
  shouldRecomputeWholeGraph,
  writeCache,
} from './nx-deps-cache';
import { buildImplicitProjectDependencies } from './build-dependencies';
import { buildWorkspaceProjectNodes } from './build-nodes';
import { loadNxPlugins } from '../utils/nx-plugin';
import { defaultFileHasher } from '../hasher/file-hasher';
import { createProjectFileMap } from './file-map-utils';
import { getRootTsConfigPath } from '../utils/typescript';
import {
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProcessorContext,
} from '../config/project-graph';
import { readJsonFile } from '../utils/fileutils';
import { NxJsonConfiguration } from '../config/nx-json';
import { logger } from '../utils/logger';
import { ProjectGraphBuilder } from './project-graph-builder';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { Workspaces } from '../config/workspaces';
import { existsSync } from 'fs';
import { PackageJson } from '../utils/package-json';

export async function buildProjectGraph() {
  const projectConfigurations = new Workspaces(
    workspaceRoot
  ).readProjectsConfigurations();
  const { projectFileMap, allWorkspaceFiles } = createProjectFileMap(
    projectConfigurations,
    defaultFileHasher.allFileData()
  );

  const cacheEnabled = process.env.NX_CACHE_PROJECT_GRAPH !== 'false';
  let cache = cacheEnabled ? readCache() : null;
  return (
    await buildProjectGraphUsingProjectFileMap(
      projectConfigurations,
      projectFileMap,
      allWorkspaceFiles,
      cache,
      cacheEnabled
    )
  ).projectGraph;
}

export async function buildProjectGraphUsingProjectFileMap(
  projectsConfigurations: ProjectsConfigurations,
  projectFileMap: ProjectFileMap,
  allWorkspaceFiles: FileData[],
  cache: ProjectGraphCache | null,
  shouldWriteCache: boolean
): Promise<{
  projectGraph: ProjectGraph;
  projectGraphCache: ProjectGraphCache;
}> {
  const nxJson = readNxJson();
  const projectGraphVersion = '5.1';
  assertWorkspaceValidity(projectsConfigurations, nxJson);
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();

  let filesToProcess;
  let cachedFileData;
  if (
    cache &&
    !shouldRecomputeWholeGraph(
      cache,
      packageJsonDeps,
      projectsConfigurations,
      nxJson,
      rootTsConfig
    )
  ) {
    const fromCache = extractCachedFileData(projectFileMap, cache);
    filesToProcess = fromCache.filesToProcess;
    cachedFileData = fromCache.cachedFileData;
  } else {
    filesToProcess = projectFileMap;
    cachedFileData = {};
  }

  const context = createContext(
    projectsConfigurations,
    nxJson,
    projectFileMap,
    filesToProcess
  );
  let projectGraph = await buildProjectGraphUsingContext(
    nxJson,
    context,
    cachedFileData,
    projectGraphVersion,
    cache
  );
  const projectGraphCache = createCache(
    nxJson,
    packageJsonDeps,
    projectGraph,
    rootTsConfig
  );
  if (shouldWriteCache) {
    writeCache(projectGraphCache);
  }
  projectGraph.allWorkspaceFiles = allWorkspaceFiles;
  return {
    projectGraph,
    projectGraphCache,
  };
}

function readCombinedDeps() {
  const installationPackageJsonPath = join(
    workspaceRoot,
    '.nx',
    'installation',
    'package.json'
  );
  const installationPackageJson: Partial<PackageJson> = existsSync(
    installationPackageJsonPath
  )
    ? readJsonFile(installationPackageJsonPath)
    : {};
  const rootPackageJsonPath = join(workspaceRoot, 'package.json');
  const rootPackageJson: Partial<PackageJson> = existsSync(rootPackageJsonPath)
    ? readJsonFile(rootPackageJsonPath)
    : {};
  return {
    ...rootPackageJson.dependencies,
    ...rootPackageJson.devDependencies,
    ...installationPackageJson.dependencies,
    ...installationPackageJson.devDependencies,
  };
}

async function buildProjectGraphUsingContext(
  nxJson: NxJsonConfiguration,
  ctx: ProjectGraphProcessorContext,
  cachedFileData: { [project: string]: { [file: string]: FileData } },
  projectGraphVersion: string,
  cache: ProjectGraphCache | null
) {
  performance.mark('build project graph:start');

  const builder = new ProjectGraphBuilder(
    cache
      ? {
          nodes: cache.nodes,
          externalNodes: cache.externalNodes,
          dependencies: cache.dependencies,
        }
      : null
  );
  builder.setVersion(projectGraphVersion);

  await buildWorkspaceProjectNodes(ctx, builder, nxJson);
  const initProjectGraph = builder.getUpdatedProjectGraph();

  const r = await updateProjectGraphWithPlugins(ctx, initProjectGraph);

  const updatedBuilder = new ProjectGraphBuilder(r);
  for (const proj of Object.keys(cachedFileData)) {
    for (const f of updatedBuilder.graph.nodes[proj].data.files) {
      const cached = cachedFileData[proj][f.file];
      if (cached && cached.dependencies) {
        f.dependencies = [...cached.dependencies];
      }
    }
  }

  buildImplicitProjectDependencies(ctx, updatedBuilder);

  const finalGraph = updatedBuilder.getUpdatedProjectGraph();

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );

  return finalGraph;
}

function createContext(
  projectsConfigurations: ProjectsConfigurations,
  nxJson: NxJsonConfiguration,
  fileMap: ProjectFileMap,
  filesToProcess: ProjectFileMap
): ProjectGraphProcessorContext {
  const projects = Object.keys(projectsConfigurations.projects).reduce(
    (map, projectName) => {
      map[projectName] = {
        ...projectsConfigurations.projects[projectName],
      };
      return map;
    },
    {} as Record<string, ProjectConfiguration>
  );
  return {
    nxJsonConfiguration: nxJson,
    projectsConfigurations,
    workspace: {
      ...projectsConfigurations,
      ...nxJson,
      projects,
    },
    fileMap,
    filesToProcess,
  };
}

async function updateProjectGraphWithPlugins(
  context: ProjectGraphProcessorContext,
  initProjectGraph: ProjectGraph
) {
  const plugins = (
    await loadNxPlugins(context.nxJsonConfiguration.plugins)
  ).filter((x) => !!x.processProjectGraph);
  let graph = initProjectGraph;
  for (const plugin of plugins) {
    try {
      graph = await plugin.processProjectGraph(graph, context);
    } catch (e) {
      const message = `Failed to process the project graph with "${plugin.name}". This will error in the future!`;
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(e);
        logger.error(message);
        return graph;
      } else {
        logger.warn(message);
        logger.warn(`Run with NX_VERBOSE_LOGGING=true to see the error.`);
      }
    }
  }
  return graph;
}

function readRootTsConfig() {
  try {
    const tsConfigPath = getRootTsConfigPath();
    if (tsConfigPath) {
      return readJsonFile(tsConfigPath, { expectComments: true });
    }
  } catch (e) {
    return {};
  }
}
