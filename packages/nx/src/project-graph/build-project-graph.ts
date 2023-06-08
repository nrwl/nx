import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { assertWorkspaceValidity } from '../utils/assert-workspace-validity';
import { FileData } from './file-utils';
import {
  createProjectFileMapCache,
  extractCachedFileData,
  ProjectFileMapCache,
  shouldRecomputeWholeGraph,
  writeCache,
} from './nx-deps-cache';
import { buildImplicitProjectDependencies } from './build-dependencies';
import { buildWorkspaceProjectNodes } from './build-nodes';
import { loadNxPlugins } from '../utils/nx-plugin';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import {
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProcessorContext,
} from '../config/project-graph';
import { readJsonFile } from '../utils/fileutils';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraphBuilder } from './project-graph-builder';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { existsSync } from 'fs';
import { PackageJson } from '../utils/package-json';

let storedProjectFileMap: ProjectFileMap | null = null;
let storedAllWorkspaceFiles: FileData[] | null = null;

export function getProjectFileMap(): {
  projectFileMap: ProjectFileMap;
  allWorkspaceFiles: FileData[];
} {
  if (!!storedProjectFileMap) {
    return {
      projectFileMap: storedProjectFileMap,
      allWorkspaceFiles: storedAllWorkspaceFiles,
    };
  } else {
    return { projectFileMap: {}, allWorkspaceFiles: [] };
  }
}

export async function buildProjectGraphUsingProjectFileMap(
  projectsConfigurations: ProjectsConfigurations,
  projectFileMap: ProjectFileMap,
  allWorkspaceFiles: FileData[],
  fileMap: ProjectFileMapCache | null,
  shouldWriteCache: boolean
): Promise<{
  projectGraph: ProjectGraph;
  projectFileMapCache: ProjectFileMapCache;
}> {
  storedProjectFileMap = projectFileMap;
  storedAllWorkspaceFiles = allWorkspaceFiles;

  const nxJson = readNxJson();
  const projectGraphVersion = '6.0';
  assertWorkspaceValidity(projectsConfigurations, nxJson);
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();

  let filesToProcess;
  let cachedFileData;
  const useCacheData =
    fileMap &&
    !shouldRecomputeWholeGraph(
      fileMap,
      packageJsonDeps,
      projectsConfigurations,
      nxJson,
      rootTsConfig
    );
  if (useCacheData) {
    const fromCache = extractCachedFileData(projectFileMap, fileMap);
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
  const projectFileMapCache = createProjectFileMapCache(
    nxJson,
    packageJsonDeps,
    projectFileMap,
    rootTsConfig
  );
  if (shouldWriteCache) {
    writeCache(projectFileMapCache, projectGraph);
  }
  return {
    projectGraph,
    projectFileMapCache,
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
  projectGraphVersion: string
) {
  performance.mark('build project graph:start');

  const builder = new ProjectGraphBuilder(null, ctx.fileMap);
  builder.setVersion(projectGraphVersion);

  await buildWorkspaceProjectNodes(ctx, builder, nxJson);
  const initProjectGraph = builder.getUpdatedProjectGraph();

  const r = await updateProjectGraphWithPlugins(ctx, initProjectGraph);

  const updatedBuilder = new ProjectGraphBuilder(r, ctx.fileMap);
  for (const proj of Object.keys(cachedFileData)) {
    for (const f of ctx.fileMap[proj] || []) {
      const cached = cachedFileData[proj][f.file];
      if (cached && cached.deps) {
        f.deps = [...cached.deps];
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
      let message = `Failed to process the project graph with "${plugin.name}".`;
      if (e instanceof Error) {
        e.message = message + '\n' + e.message;
        throw e;
      }
      throw new Error(message);
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
