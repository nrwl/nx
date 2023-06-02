import {
  DependencyType,
  ProjectFileMap,
  ProjectGraphProcessorContext,
} from '../../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import { join } from 'path';
import { buildExplicitTypescriptAndPackageJsonDependencies } from './build-explicit-typescript-and-package-json-dependencies';
import * as os from 'os';

export function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  let totalNumOfFilesToProcess = totalNumberOfFilesToProcess(ctx);
  if (totalNumOfFilesToProcess === 0) return;
  // using workers has an overhead, so we only do it when the number of
  // files we need to process is >= 100 and there are more than 2 CPUs
  // to be able to use at least 2 workers (1 worker per CPU and
  // 1 CPU for the main thread)
  if (
    jsPluginConfig.analyzeSourceFiles === false ||
    totalNumOfFilesToProcess < 100 ||
    getNumberOfWorkers() <= 2
  ) {
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
    ctx.nxJsonConfiguration,
    ctx.projectsConfigurations,
    builder.graph,
    ctx.filesToProcess
  ).forEach((r) => {
    if (r.type === DependencyType.static) {
      builder.addStaticDependency(
        r.sourceProjectName,
        r.targetProjectName,
        r.sourceProjectFile
      );
    } else {
      builder.addDynamicDependency(
        r.sourceProjectName,
        r.targetProjectName,
        r.sourceProjectFile
      );
    }
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
        nxJsonConfiguration: ctx.nxJsonConfiguration,
        projectsConfigurations: ctx.projectsConfigurations,
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
    : Math.min(os.cpus().length - 1, 8); // This is capped for cases in CI where `os.cpus()` returns way more CPUs than the resources that are allocated
}
