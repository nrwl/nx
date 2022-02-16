import {
  FileData,
  logger,
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
  ProjectConfiguration,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
  readJsonFile,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { assertWorkspaceValidity } from '../assert-workspace-validity';
import { readNxJson, readWorkspaceJson } from '../file-utils';
import { normalizeNxJson } from '../normalize-nx-json';
import {
  createCache,
  extractCachedFileData,
  ProjectGraphCache,
  readCache,
  shouldRecomputeWholeGraph,
  writeCache,
} from '../nx-deps/nx-deps-cache';
import { buildImplicitProjectDependencies } from './build-dependencies';
import {
  buildNpmPackageNodes,
  buildWorkspaceProjectNodes,
} from './build-nodes';
import { existsSync } from 'fs';
import * as os from 'os';
import { buildExplicitTypescriptAndPackageJsonDependencies } from './build-dependencies/build-explicit-typescript-and-package-json-dependencies';
import { loadNxPlugins } from '@nrwl/tao/src/shared/nx-plugin';
import { defaultFileHasher } from '../hasher/file-hasher';
import { createProjectFileMap } from '../file-map-utils';

export async function buildProjectGraph() {
  const workspaceJson = readWorkspaceJson();
  const { projectFileMap, allWorkspaceFiles } = createProjectFileMap(
    workspaceJson,
    defaultFileHasher.allFileData()
  );

  const cacheEnabled = process.env.NX_CACHE_PROJECT_GRAPH !== 'false';
  let cache = cacheEnabled ? readCache() : null;

  return (
    await buildProjectGraphUsingProjectFileMap(
      workspaceJson,
      projectFileMap,
      allWorkspaceFiles,
      cache,
      cacheEnabled
    )
  ).projectGraph;
}

export async function buildProjectGraphUsingProjectFileMap(
  workspaceJson: WorkspaceJsonConfiguration,
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
  assertWorkspaceValidity(workspaceJson, nxJson);
  const normalizedNxJson = normalizeNxJson(
    nxJson,
    Object.keys(workspaceJson.projects)
  );
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();

  let filesToProcess;
  let cachedFileData;
  if (
    cache &&
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
  } else {
    filesToProcess = projectFileMap;
    cachedFileData = {};
  }
  const context = createContext(
    workspaceJson,
    normalizedNxJson,
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
  const json = readJsonFile(join(appRootPath, 'package.json'));
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

  const r = updateProjectGraphWithPlugins(ctx, initProjectGraph);

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );

  return r;
}

function jsPluginConfig(nxJson: any) {
  if (
    nxJson &&
    nxJson &&
    nxJson?.pluginsConfig &&
    nxJson?.pluginsConfig['@nrwl/js']
  ) {
    return nxJson?.pluginsConfig['@nrwl/js'];
  } else {
    return {};
  }
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
  const numberOfWorkers = getNumberOfWorkers();
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
  const plugins = loadNxPlugins(context.workspace.plugins).filter(
    (x) => !!x.processProjectGraph
  );
  return (plugins || []).reduce((graph, plugin) => {
    try {
      return plugin.processProjectGraph(graph, context);
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
