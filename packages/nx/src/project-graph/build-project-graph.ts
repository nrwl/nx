import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { assertWorkspaceValidity } from '../utils/assert-workspace-validity';
import { FileData } from './file-utils';
import {
  CachedFileData,
  createProjectFileMapCache,
  extractCachedFileData,
  FileMapCache,
  shouldRecomputeWholeGraph,
} from './nx-deps-cache';
import { applyImplicitDependencies } from './utils/implicit-project-dependencies';
import { normalizeProjectNodes } from './utils/normalize-project-nodes';
import { LoadedNxPlugin } from './plugins/internal-api';
import { isNxPluginV1, isNxPluginV2 } from './plugins/utils';
import {
  CreateDependenciesContext,
  CreateMetadataContext,
  ProjectsMetadata,
} from './plugins';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { readJsonFile } from '../utils/fileutils';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraphBuilder } from './project-graph-builder';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { existsSync } from 'fs';
import { PackageJson } from '../utils/package-json';
import { output } from '../utils/output';
import { NxWorkspaceFilesExternals } from '../native';
import {
  AggregateCreateMetadataError,
  AggregateProjectGraphError,
  CreateDependenciesError,
  CreateMetadataError,
  isCreateMetadataError,
  isPartialProjectGraphError,
  ProcessDependenciesError,
  ProcessProjectGraphError,
} from './error-types';

let storedFileMap: FileMap | null = null;
let storedAllWorkspaceFiles: FileData[] | null = null;
let storedRustReferences: NxWorkspaceFilesExternals | null = null;

export function getFileMap(): {
  fileMap: FileMap;
  allWorkspaceFiles: FileData[];
  rustReferences: NxWorkspaceFilesExternals | null;
} {
  if (!!storedFileMap) {
    return {
      fileMap: storedFileMap,
      allWorkspaceFiles: storedAllWorkspaceFiles,
      rustReferences: storedRustReferences,
    };
  } else {
    return {
      fileMap: {
        nonProjectFiles: [],
        projectFileMap: {},
      },
      allWorkspaceFiles: [],
      rustReferences: null,
    };
  }
}

export async function buildProjectGraphUsingProjectFileMap(
  projects: Record<string, ProjectConfiguration>,
  externalNodes: Record<string, ProjectGraphExternalNode>,
  fileMap: FileMap,
  allWorkspaceFiles: FileData[],
  rustReferences: NxWorkspaceFilesExternals,
  fileMapCache: FileMapCache | null,
  plugins: LoadedNxPlugin[]
): Promise<{
  projectGraph: ProjectGraph;
  projectFileMapCache: FileMapCache;
}> {
  storedFileMap = fileMap;
  storedAllWorkspaceFiles = allWorkspaceFiles;
  storedRustReferences = rustReferences;

  const nxJson = readNxJson();
  const projectGraphVersion = '6.0';
  assertWorkspaceValidity(projects, nxJson);
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();

  let filesToProcess: FileMap;
  let cachedFileData: CachedFileData;
  const useCacheData =
    fileMapCache &&
    !shouldRecomputeWholeGraph(
      fileMapCache,
      packageJsonDeps,
      projects,
      nxJson,
      rootTsConfig
    );
  if (useCacheData) {
    const fromCache = extractCachedFileData(fileMap, fileMapCache);
    filesToProcess = fromCache.filesToProcess;
    cachedFileData = fromCache.cachedFileData;
  } else {
    filesToProcess = fileMap;
    cachedFileData = {
      nonProjectFiles: {},
      projectFileMap: {},
    };
  }

  const context = createContext(
    projects,
    nxJson,
    externalNodes,
    fileMap,
    filesToProcess
  );
  let projectGraph = await buildProjectGraphUsingContext(
    externalNodes,
    context,
    cachedFileData,
    projectGraphVersion,
    plugins
  );
  const projectFileMapCache = createProjectFileMapCache(
    nxJson,
    packageJsonDeps,
    fileMap,
    rootTsConfig
  );
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
  knownExternalNodes: Record<string, ProjectGraphExternalNode>,
  ctx: CreateDependenciesContext,
  cachedFileData: CachedFileData,
  projectGraphVersion: string,
  plugins: LoadedNxPlugin[]
) {
  performance.mark('build project graph:start');

  const builder = new ProjectGraphBuilder(null, ctx.fileMap.projectFileMap);
  builder.setVersion(projectGraphVersion);
  for (const node in knownExternalNodes) {
    builder.addExternalNode(knownExternalNodes[node]);
  }

  await normalizeProjectNodes(ctx, builder);
  const initProjectGraph = builder.getUpdatedProjectGraph();

  let updatedGraph;
  let error:
    | CreateDependenciesError
    | AggregateCreateMetadataError
    | AggregateProjectGraphError;
  try {
    updatedGraph = await updateProjectGraphWithPlugins(
      ctx,
      initProjectGraph,
      plugins
    );
  } catch (e) {
    if (isPartialProjectGraphError(e)) {
      updatedGraph = e.partialProjectGraph;
      error = e;
    } else {
      throw e;
    }
  }

  const updatedBuilder = new ProjectGraphBuilder(
    updatedGraph,
    ctx.fileMap.projectFileMap
  );
  for (const proj of Object.keys(cachedFileData.projectFileMap)) {
    for (const f of ctx.fileMap.projectFileMap[proj] || []) {
      const cached = cachedFileData.projectFileMap[proj][f.file];
      if (cached && cached.deps) {
        f.deps = [...cached.deps];
      }
    }
  }
  for (const file of ctx.fileMap.nonProjectFiles) {
    const cached = cachedFileData.nonProjectFiles[file.file];
    if (cached?.deps) {
      file.deps = [...cached.deps];
    }
  }

  applyImplicitDependencies(ctx.projects, updatedBuilder);

  const finalGraph = updatedBuilder.getUpdatedProjectGraph();

  performance.mark('build project graph:end');
  performance.measure(
    'build project graph',
    'build project graph:start',
    'build project graph:end'
  );

  if (!error) {
    return finalGraph;
  } else {
    throw new AggregateProjectGraphError(error.errors, finalGraph);
  }
}

function createContext(
  projects: Record<string, ProjectConfiguration>,
  nxJson: NxJsonConfiguration,
  externalNodes: Record<string, ProjectGraphExternalNode>,
  fileMap: FileMap,
  filesToProcess: FileMap
): CreateDependenciesContext {
  const clonedProjects = Object.keys(projects).reduce((map, projectName) => {
    map[projectName] = {
      ...projects[projectName],
    };
    return map;
  }, {} as Record<string, ProjectConfiguration>);
  return {
    nxJsonConfiguration: nxJson,
    projects: clonedProjects,
    externalNodes,
    workspaceRoot,
    fileMap,
    filesToProcess,
  };
}

async function updateProjectGraphWithPlugins(
  context: CreateDependenciesContext,
  initProjectGraph: ProjectGraph,
  plugins: LoadedNxPlugin[]
) {
  let graph = initProjectGraph;
  const errors: Array<ProcessDependenciesError | ProcessProjectGraphError> = [];
  for (const plugin of plugins) {
    try {
      if (
        isNxPluginV1(plugin) &&
        plugin.processProjectGraph &&
        !plugin.createDependencies
      ) {
        output.warn({
          title: `${plugin.name} is a v1 plugin.`,
          bodyLines: [
            'Nx has recently released a v2 model for project graph plugins. The `processProjectGraph` method is deprecated. Plugins should use some combination of `createNodes` and `createDependencies` instead.',
          ],
        });
        performance.mark(`${plugin.name}:processProjectGraph - start`);
        graph = await plugin.processProjectGraph(graph, {
          ...context,
          projectsConfigurations: {
            projects: context.projects,
            version: 2,
          },
          fileMap: context.fileMap.projectFileMap,
          filesToProcess: context.filesToProcess.projectFileMap,
          workspace: {
            version: 2,
            projects: context.projects,
            ...context.nxJsonConfiguration,
          },
        });
        performance.mark(`${plugin.name}:processProjectGraph - end`);
        performance.measure(
          `${plugin.name}:processProjectGraph`,
          `${plugin.name}:processProjectGraph - start`,
          `${plugin.name}:processProjectGraph - end`
        );
      }
    } catch (e) {
      errors.push(
        new ProcessProjectGraphError(plugin.name, {
          cause: e,
        })
      );
    }
  }

  const builder = new ProjectGraphBuilder(
    graph,
    context.fileMap.projectFileMap,
    context.fileMap.nonProjectFiles
  );

  const createDependencyPlugins = plugins.filter(
    (plugin) => isNxPluginV2(plugin) && plugin.createDependencies
  );
  await Promise.all(
    createDependencyPlugins.map(async (plugin) => {
      performance.mark(`${plugin.name}:createDependencies - start`);

      try {
        const dependencies = await plugin.createDependencies({
          ...context,
        });

        for (const dep of dependencies) {
          builder.addDependency(
            dep.source,
            dep.target,
            dep.type,
            'sourceFile' in dep ? dep.sourceFile : null
          );
        }
      } catch (cause) {
        errors.push(
          new ProcessDependenciesError(plugin.name, {
            cause,
          })
        );
      }

      performance.mark(`${plugin.name}:createDependencies - end`);
      performance.measure(
        `${plugin.name}:createDependencies`,
        `${plugin.name}:createDependencies - start`,
        `${plugin.name}:createDependencies - end`
      );
    })
  );

  const result = builder.getUpdatedProjectGraph();

  if (errors.length > 0) {
    throw new CreateDependenciesError(errors, result);
  }

  return await applyProjectMetadata(result, plugins, {
    graph: result,
    nxJsonConfiguration: context.nxJsonConfiguration,
    workspaceRoot,
  });
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

export async function applyProjectMetadata(
  graph: ProjectGraph,
  plugins: LoadedNxPlugin[],
  context: CreateMetadataContext
): Promise<ProjectGraph> {
  const metadataResultPromises: Array<
    Promise<ProjectsMetadata | CreateMetadataError>
  > = [];

  for (const plugin of plugins) {
    if (plugin.createMetadata) {
      const metadata = Promise.resolve(plugin.createMetadata(context)).catch(
        (e) => new CreateMetadataError(e, plugin.name)
      );
      metadataResultPromises.push(metadata);
    }
  }

  const metadataResults = await Promise.all(metadataResultPromises);
  const errors: CreateMetadataError[] = [];

  for (const result of metadataResults) {
    if (isCreateMetadataError(result)) {
      errors.push(result);
    } else {
      for (const project in result) {
        const projectConfiguration: ProjectConfiguration =
          graph.nodes[project]?.data;
        if (projectConfiguration) {
          projectConfiguration.metadata = mergeProjectLevelMetadata(
            projectConfiguration.metadata,
            result[project].metadata
          );
          for (const target in result[project].targets || {}) {
            if (projectConfiguration.targets[target]) {
              projectConfiguration.targets[target].metadata =
                mergeTargetLevelMetadata(
                  projectConfiguration.targets[target].metadata,
                  result[project].targets[target].metadata
                );
            }
          }
        }
      }
    }
  }

  return graph;
}

function mergeProjectLevelMetadata(
  a: ProjectConfiguration['metadata'],
  b: ProjectConfiguration['metadata']
) {
  if ('targetGroups' in b) {
    a.targetGroups ??= {};
    for (const targetGroup in b.targetGroups) {
      a.targetGroups[targetGroup] = {
        ...a.targetGroups[targetGroup],
        ...b.targetGroups[targetGroup],
      };
    }
  }

  if ('technologies' in b) {
    a.technologies ??= [];
    a.technologies = Array.from(
      new Set([...a.technologies, ...b.technologies])
    );
  }

  return a;
}

function mergeTargetLevelMetadata(
  a: ProjectConfiguration['targets'][string]['metadata'],
  b: ProjectConfiguration['targets'][string]['metadata']
) {
  if ('technologies' in b) {
    a.technologies ??= [];
    a.technologies = Array.from(
      new Set([...a.technologies, ...b.technologies])
    );
  }

  a.description = b.description ?? a.description;

  return a;
}
