import { existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { readNxJson } from '../config/configuration';
import { NxJsonConfiguration } from '../config/nx-json';
import {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { hashObject } from '../hasher/file-hasher';
import { NxWorkspaceFilesExternals } from '../native';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import { assertWorkspaceValidity } from '../utils/assert-workspace-validity';
import { DelayedSpinner } from '../utils/delayed-spinner';
import { readJsonFile } from '../utils/fileutils';
import { PackageJson } from '../utils/package-json';
import { formatPluginProgressText } from '../utils/plugin-progress-text';
import { ProgressTopics } from '../utils/progress-topics';
import { workspaceRoot } from '../utils/workspace-root';
import {
  AggregateProjectGraphError,
  CreateMetadataError,
  isAggregateProjectGraphError,
  isWorkspaceValidityError,
  ProcessDependenciesError,
  WorkspaceValidityError,
} from './error-types';
import { FileData } from './file-utils';
import {
  CachedFileData,
  createProjectFileMapCache,
  extractCachedFileData,
  FileMapCache,
  shouldRecomputeWholeGraph,
} from './nx-deps-cache';
import {
  CreateDependenciesContext,
  CreateMetadataContext,
  ProjectsMetadata,
} from './plugins';
import type { LoadedNxPlugin } from './plugins/loaded-nx-plugin';
import { ProjectGraphBuilder } from './project-graph-builder';
import { applyImplicitDependencies } from './utils/implicit-project-dependencies';
import { normalizeProjectNodes } from './utils/normalize-project-nodes';
import type { ConfigurationSourceMaps } from './utils/project-configuration/source-maps';
import { mergeMetadata } from './utils/project-configuration/target-merging';

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

export function hydrateFileMap(
  fileMap: FileMap,
  allWorkspaceFiles: FileData[],
  rustReferences: NxWorkspaceFilesExternals
) {
  storedFileMap = fileMap;
  storedAllWorkspaceFiles = allWorkspaceFiles;
  storedRustReferences = rustReferences;
}

export async function buildProjectGraphUsingProjectFileMap(
  projectRootMap: Record<string, ProjectConfiguration>,
  externalNodes: Record<string, ProjectGraphExternalNode>,
  fileMap: FileMap,
  allWorkspaceFiles: FileData[],
  rustReferences: NxWorkspaceFilesExternals,
  fileMapCache: FileMapCache | null,
  plugins: LoadedNxPlugin[],
  sourceMap: ConfigurationSourceMaps
): Promise<{
  projectGraph: ProjectGraph;
  projectFileMapCache: FileMapCache;
}> {
  storedFileMap = fileMap;
  storedAllWorkspaceFiles = allWorkspaceFiles;
  storedRustReferences = rustReferences;

  const projects: Record<string, ProjectConfiguration> = {};
  for (const root in projectRootMap) {
    const project = projectRootMap[root];
    projects[project.name] = project;
  }

  const errors: Array<
    CreateMetadataError | ProcessDependenciesError | WorkspaceValidityError
  > = [];

  const nxJson = readNxJson();
  const projectGraphVersion = '6.0';
  try {
    assertWorkspaceValidity(projects, nxJson);
  } catch (e) {
    if (isWorkspaceValidityError(e)) {
      errors.push(e);
    }
  }
  const packageJsonDeps = readCombinedDeps();
  const rootTsConfig = readRootTsConfig();
  const externalNodesHash = hashExternalNodes(externalNodes);

  let filesToProcess: FileMap;
  let cachedFileData: CachedFileData;
  const useCacheData =
    fileMapCache &&
    !shouldRecomputeWholeGraph(
      fileMapCache,
      packageJsonDeps,
      projects,
      nxJson,
      rootTsConfig,
      externalNodesHash
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

  let projectGraph: ProjectGraph;
  let projectFileMapCache: FileMapCache;
  try {
    const context = createContext(
      projects,
      nxJson,
      externalNodes,
      fileMap,
      filesToProcess
    );
    projectGraph = await buildProjectGraphUsingContext(
      externalNodes,
      context,
      cachedFileData,
      projectGraphVersion,
      plugins,
      sourceMap
    );
    projectFileMapCache = createProjectFileMapCache(
      nxJson,
      packageJsonDeps,
      fileMap,
      rootTsConfig,
      externalNodesHash
    );
  } catch (e) {
    // we need to include the workspace validity errors in the final error
    if (isAggregateProjectGraphError(e)) {
      errors.push(...e.errors);
      throw new AggregateProjectGraphError(errors, e.partialProjectGraph);
    } else {
      throw e;
    }
  }

  if (errors.length > 0) {
    throw new AggregateProjectGraphError(errors, projectGraph);
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
  knownExternalNodes: Record<string, ProjectGraphExternalNode>,
  ctx: CreateDependenciesContext,
  cachedFileData: CachedFileData,
  projectGraphVersion: string,
  plugins: LoadedNxPlugin[],
  sourceMap: ConfigurationSourceMaps
) {
  const builder = new ProjectGraphBuilder(null, ctx.fileMap.projectFileMap);
  builder.setVersion(projectGraphVersion);
  for (const node in knownExternalNodes) {
    builder.addExternalNode(knownExternalNodes[node]);
  }

  await normalizeProjectNodes(ctx, builder);
  const initProjectGraph = builder.getUpdatedProjectGraph();

  let updatedGraph;
  let error: AggregateProjectGraphError;
  try {
    updatedGraph = await updateProjectGraphWithPlugins(
      ctx,
      initProjectGraph,
      plugins,
      sourceMap
    );
  } catch (e) {
    if (isAggregateProjectGraphError(e)) {
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
  return {
    nxJsonConfiguration: nxJson,
    projects,
    externalNodes,
    workspaceRoot,
    fileMap,
    filesToProcess,
  };
}

async function updateProjectGraphWithPlugins(
  context: CreateDependenciesContext,
  initProjectGraph: ProjectGraph,
  plugins: LoadedNxPlugin[],
  sourceMap: ConfigurationSourceMaps
) {
  let graph = initProjectGraph;
  const errors: Array<ProcessDependenciesError | CreateMetadataError> = [];

  const builder = new ProjectGraphBuilder(
    graph,
    context.fileMap.projectFileMap,
    context.fileMap.nonProjectFiles
  );

  const createDependencyPlugins = plugins.filter(
    (plugin) => plugin.createDependencies
  );
  performance.mark('createDependencies:start');

  let spinner: DelayedSpinner;
  const inProgressPlugins = new Set<string>(
    createDependencyPlugins.map((plugin) => plugin.name)
  );

  const getSpinnerText = () =>
    spinner
      ? formatPluginProgressText(
          'Creating project graph dependencies',
          inProgressPlugins
        )
      : '';

  spinner = new DelayedSpinner(getSpinnerText(), {
    progressTopic: ProgressTopics.GraphConstruction,
  });

  await Promise.all(
    createDependencyPlugins.map(async (plugin) => {
      performance.mark(`${plugin.name}:createDependencies - start`);
      try {
        const dependencies = await plugin
          .createDependencies({
            ...context,
          })
          .finally(() => {
            inProgressPlugins.delete(plugin.name);
            spinner.setMessage(getSpinnerText());
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
      performance.measure(`${plugin.name}:createDependencies`, {
        start: `${plugin.name}:createDependencies - start`,
        end: `${plugin.name}:createDependencies - end`,
        detail: { track: true },
      });
    })
  );
  performance.mark('createDependencies:end');
  performance.measure(
    `createDependencies`,
    `createDependencies:start`,
    `createDependencies:end`
  );
  spinner?.cleanup();

  const graphWithDeps = builder.getUpdatedProjectGraph();

  const { errors: metadataErrors, graph: updatedGraph } =
    await applyProjectMetadata(
      graphWithDeps,
      plugins,
      {
        nxJsonConfiguration: context.nxJsonConfiguration,
        workspaceRoot,
      },
      sourceMap
    );

  errors.push(...metadataErrors);

  if (errors.length > 0) {
    throw new AggregateProjectGraphError(errors, updatedGraph);
  }

  return updatedGraph;
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
  context: CreateMetadataContext,
  sourceMap: ConfigurationSourceMaps
): Promise<{ graph: ProjectGraph; errors?: CreateMetadataError[] }> {
  const results: { metadata: ProjectsMetadata; pluginName: string }[] = [];
  const errors: CreateMetadataError[] = [];

  performance.mark('createMetadata:start');
  let spinner: DelayedSpinner;
  const createMetadataPlugins = plugins.filter(
    (plugin) => plugin.createMetadata
  );

  const inProgressPlugins = new Set<string>(
    createMetadataPlugins.map((p) => p.name)
  );

  const getSpinnerText = () =>
    spinner
      ? formatPluginProgressText('Creating project metadata', inProgressPlugins)
      : '';

  spinner = createMetadataPlugins.length
    ? new DelayedSpinner(getSpinnerText(), {
        progressTopic: ProgressTopics.GraphConstruction,
      })
    : undefined;

  const promises = createMetadataPlugins.map(async (plugin) => {
    performance.mark(`${plugin.name}:createMetadata - start`);
    try {
      const metadata = await plugin.createMetadata(graph, context);
      results.push({ metadata, pluginName: plugin.name });
    } catch (e) {
      errors.push(new CreateMetadataError(e, plugin.name));
    } finally {
      inProgressPlugins.delete(plugin.name);
      spinner.setMessage(getSpinnerText());
      performance.mark(`${plugin.name}:createMetadata - end`);
      performance.measure(
        `${plugin.name}:createMetadata`,
        `${plugin.name}:createMetadata - start`,
        `${plugin.name}:createMetadata - end`
      );
    }
  });

  await Promise.all(promises);

  spinner?.cleanup();

  for (const { metadata: projectsMetadata, pluginName } of results) {
    for (const project in projectsMetadata) {
      const projectConfiguration: ProjectConfiguration =
        graph.nodes[project]?.data;
      if (projectConfiguration) {
        projectConfiguration.metadata = mergeMetadata(
          sourceMap[project],
          [null, pluginName],
          'metadata',
          projectsMetadata[project].metadata,
          projectConfiguration.metadata
        );
      }
    }
  }

  performance.mark('createMetadata:end');
  performance.measure(
    `createMetadata`,
    `createMetadata:start`,
    `createMetadata:end`
  );

  return { errors, graph };
}

function hashExternalNodes(
  externalNodes: Record<string, ProjectGraphExternalNode>
): string {
  return hashObject(
    Object.entries(externalNodes).reduce((acc, [name, node]) => {
      acc[name] = node.data.version;
      return acc;
    }, {})
  );
}
