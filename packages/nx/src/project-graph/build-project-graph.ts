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
import { applyImplicitDependencies } from './utils/implicit-project-dependencies';
import { normalizeProjectNodes } from './utils/normalize-project-nodes';
import { isNxPluginV1, isNxPluginV2, loadNxPlugins } from '../utils/nx-plugin';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import {
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProcessorContext,
} from '../config/project-graph';
import { readJsonFile } from '../utils/fileutils';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraphBuilder } from './project-graph-builder';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
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
  projects: Record<string, ProjectConfiguration>,
  externalNodes: Record<string, ProjectGraphExternalNode>,
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
  assertWorkspaceValidity(projects, nxJson);
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();

  let filesToProcess;
  let cachedFileData;
  const useCacheData =
    fileMap &&
    !shouldRecomputeWholeGraph(
      fileMap,
      packageJsonDeps,
      projects,
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
    projects,
    nxJson,
    projectFileMap,
    filesToProcess
  );
  let projectGraph = await buildProjectGraphUsingContext(
    nxJson,
    externalNodes,
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
  knownExternalNodes: Record<string, ProjectGraphExternalNode>,
  ctx: ProjectGraphProcessorContext,
  cachedFileData: { [project: string]: { [file: string]: FileData } },
  projectGraphVersion: string
) {
  performance.mark('build project graph:start');

  const builder = new ProjectGraphBuilder(null, ctx.fileMap);
  builder.setVersion(projectGraphVersion);
  for (const node in knownExternalNodes) {
    builder.addExternalNode(knownExternalNodes[node]);
  }

  await normalizeProjectNodes(ctx, builder, nxJson);
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

  applyImplicitDependencies(ctx.projectsConfigurations, updatedBuilder);

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
  projects: Record<string, ProjectConfiguration>,
  nxJson: NxJsonConfiguration,
  fileMap: ProjectFileMap,
  filesToProcess: ProjectFileMap
): ProjectGraphProcessorContext {
  const clonedProjects = Object.keys(projects).reduce((map, projectName) => {
    map[projectName] = {
      ...projects[projectName],
    };
    return map;
  }, {} as Record<string, ProjectConfiguration>);
  return {
    nxJsonConfiguration: nxJson,
    workspace: {
      version: 2,
      projects: clonedProjects,
      ...nxJson,
    },
    projectsConfigurations: {
      version: 2,
      projects: clonedProjects,
    },
    fileMap,
    filesToProcess,
  };
}

async function updateProjectGraphWithPlugins(
  context: ProjectGraphProcessorContext,
  initProjectGraph: ProjectGraph
) {
  const plugins = await loadNxPlugins(context.nxJsonConfiguration?.plugins);
  let graph = initProjectGraph;
  for (const plugin of plugins) {
    try {
      if (
        isNxPluginV1(plugin) &&
        plugin.processProjectGraph &&
        !plugin.createDependencies
      ) {
        // TODO(@AgentEnder): Enable after rewriting nx-js-graph-plugin to v2
        // output.warn({
        //   title: `${plugin.name} is a v1 plugin.`,
        //   bodyLines: [
        //     'Nx has recently released a v2 model for project graph plugins. The `processProjectGraph` method is deprecated. Plugins should use some combination of `createNodes` and `createDependencies` instead.',
        //   ],
        // });
        graph = await plugin.processProjectGraph(graph, context);
      }
    } catch (e) {
      let message = `Failed to process the project graph with "${plugin.name}".`;
      if (e instanceof Error) {
        e.message = message + '\n' + e.message;
        throw e;
      }
      throw new Error(message);
    }
  }
  for (const plugin of plugins) {
    try {
      if (isNxPluginV2(plugin) && plugin.createDependencies) {
        const builder = new ProjectGraphBuilder(graph, context.fileMap);
        const newDependencies = await plugin.createDependencies({
          ...context,
          graph,
        });
        for (const targetProjectDependency of newDependencies) {
          builder.addDependency(
            targetProjectDependency.source,
            targetProjectDependency.target,
            targetProjectDependency.dependencyType,
            targetProjectDependency.sourceFile
          );
        }
        graph = builder.getUpdatedProjectGraph();
      }
    } catch (e) {
      let message = `Failed to process project dependencies with "${plugin.name}".`;
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
