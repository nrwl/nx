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
import {
  buildNpmPackageNodes,
  buildWorkspaceProjectNodes,
} from './build-nodes';
import * as os from 'os';
import { buildExplicitTypescriptAndPackageJsonDependencies } from './build-dependencies/build-explicit-typescript-and-package-json-dependencies';
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
import {
  readAllWorkspaceConfiguration,
  readNxJson,
} from '../config/configuration';

export async function buildProjectGraph() {
  const projectConfigurations = readAllWorkspaceConfiguration();
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
  const projectGraphVersion = '5.0';
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
    projectGraphVersion
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
  const json = readJsonFile(join(workspaceRoot, 'package.json'));
  return { ...json.dependencies, ...json.devDependencies };
}

async function buildProjectGraphUsingContext(
  nxJson: NxJsonConfiguration,
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
      if (cached && cached.deps) {
        f.deps = [...cached.deps];
      }
    }
  }

  await buildExplicitDependencies(jsPluginConfig(nxJson), ctx, builder);

  buildImplicitProjectDependencies(ctx, builder);
  builder.setVersion(projectGraphVersion);
  const initProjectGraph = builder.getUpdatedProjectGraph();

  const r = await updateProjectGraphWithPlugins(ctx, initProjectGraph);

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );

  return r;
}

interface NrwlJsPluginConfig {
  analyzeSourceFiles?: boolean;
  analyzePackageJson?: boolean;
}

function jsPluginConfig(nxJson: NxJsonConfiguration): NrwlJsPluginConfig {
  return nxJson?.pluginsConfig?.['@nrwl/js'] ?? {};
}

function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  let totalNumOfFilesToProcess = totalNumberOfFilesToProcess(ctx);
  // using workers has an overhead, so we only do it when the number of
  // files we need to process is >= 100 and there are more than 2 CPUs
  // to be able to use at least 2 workers (1 worker per CPU and
  // 1 CPU for the main thread)
  if (totalNumOfFilesToProcess < 100 || getNumberOfWorkers() <= 2) {
    return buildExplicitDependenciesWithoutWorkers(
      jsPluginConfig,
      ctx,
      builder
    );
  } else {
    return buildExplicitDependenciesUsingWorkers(
      jsPluginConfig,
      ctx,
      totalNumOfFilesToProcess,
      builder
    );
  }
}

function totalNumberOfFilesToProcess(ctx: ProjectGraphProcessorContext) {
  let totalNumOfFilesToProcess = 0;
  Object.values(ctx.filesToProcess).forEach(
    (t) => (totalNumOfFilesToProcess += t.length)
  );
  return totalNumOfFilesToProcess;
}

function splitFilesIntoBins(
  ctx: ProjectGraphProcessorContext,
  totalNumOfFilesToProcess: number,
  numberOfWorkers: number
) {
  // we want to have numberOfWorkers * 5 bins
  const filesPerBin =
    Math.round(totalNumOfFilesToProcess / numberOfWorkers / 5) + 1;
  const bins: ProjectFileMap[] = [];
  let currentProjectFileMap = {};
  let currentNumberOfFiles = 0;
  for (const source of Object.keys(ctx.filesToProcess)) {
    for (const f of Object.values(ctx.filesToProcess[source])) {
      if (!currentProjectFileMap[source]) currentProjectFileMap[source] = [];
      currentProjectFileMap[source].push(f);
      currentNumberOfFiles++;

      if (currentNumberOfFiles >= filesPerBin) {
        bins.push(currentProjectFileMap);
        currentProjectFileMap = {};
        currentNumberOfFiles = 0;
      }
    }
  }
  bins.push(currentProjectFileMap);
  return bins;
}

function createWorkerPool(numberOfWorkers: number) {
  const res = [];
  for (let i = 0; i < numberOfWorkers; ++i) {
    res.push(
      new (require('worker_threads').Worker)(
        join(__dirname, './project-graph-worker.js'),
        {
          env: process.env,
        }
      )
    );
  }
  return res;
}

function buildExplicitDependenciesWithoutWorkers(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  buildExplicitTypescriptAndPackageJsonDependencies(
    jsPluginConfig,
    ctx.workspace,
    builder.graph,
    ctx.filesToProcess
  ).forEach((r) => {
    builder.addExplicitDependency(
      r.sourceProjectName,
      r.sourceProjectFile,
      r.targetProjectName
    );
  });
}

function buildExplicitDependenciesUsingWorkers(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: ProjectGraphProcessorContext,
  totalNumOfFilesToProcess: number,
  builder: ProjectGraphBuilder
) {
  const numberOfWorkers = Math.min(
    totalNumOfFilesToProcess,
    getNumberOfWorkers()
  );
  const bins = splitFilesIntoBins(
    ctx,
    totalNumOfFilesToProcess,
    numberOfWorkers
  );
  const workers = createWorkerPool(numberOfWorkers);
  let numberOfExpectedResponses = bins.length;

  return new Promise((res, reject) => {
    for (let w of workers) {
      w.on('message', (explicitDependencies) => {
        explicitDependencies.forEach((r) => {
          builder.addExplicitDependency(
            r.sourceProjectName,
            r.sourceProjectFile,
            r.targetProjectName
          );
        });
        if (bins.length > 0) {
          w.postMessage({ filesToProcess: bins.shift() });
        }
        // we processed all the bins
        if (--numberOfExpectedResponses === 0) {
          for (let w of workers) {
            w.terminate();
          }
          res(null);
        }
      });
      w.on('error', reject);
      w.on('exit', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Unable to complete project graph creation. Worker stopped with exit code: ${code}`
            )
          );
        }
      });
      w.postMessage({
        workspace: ctx.workspace,
        projectGraph: builder.graph,
        jsPluginConfig,
      });
      w.postMessage({ filesToProcess: bins.shift() });
    }
  });
}

function getNumberOfWorkers(): number {
  return process.env.NX_PROJECT_GRAPH_MAX_WORKERS
    ? +process.env.NX_PROJECT_GRAPH_MAX_WORKERS
    : os.cpus().length - 1;
}

function createContext(
  projectsConfigurations: ProjectsConfigurations,
  nxJson: NxJsonConfiguration,
  fileMap: ProjectFileMap,
  filesToProcess: ProjectFileMap
): ProjectGraphProcessorContext {
  const projects: Record<string, ProjectConfiguration> = Object.keys(
    projectsConfigurations.projects
  ).reduce((map, projectName) => {
    map[projectName] = {
      ...projectsConfigurations.projects[projectName],
    };
    return map;
  }, {});
  return {
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
  const plugins = loadNxPlugins(context.workspace.plugins).filter(
    (x) => !!x.processProjectGraph
  );
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
  const tsConfigPath = getRootTsConfigPath();
  if (tsConfigPath) {
    return readJsonFile(tsConfigPath);
  }
}
