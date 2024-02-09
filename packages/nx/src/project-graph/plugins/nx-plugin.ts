import {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { workspaceRoot } from '../../utils/workspace-root';

import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { NxJsonConfiguration, PluginConfiguration } from '../../config/nx-json';

import { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import { RawProjectGraphDependency } from '../project-graph-builder';
import { shouldMergeAngularProjects } from '../../adapter/angular-json';

import { loadRemoteNxPlugin } from './plugin-pool';
import { join } from 'path';

/**
 * Context for {@link CreateNodesFunction}
 */
export interface CreateNodesContext {
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly workspaceRoot: string;
}

/**
 * A function which parses a configuration file into a set of nodes.
 * Used for creating nodes for the {@link ProjectGraph}
 */
export type CreateNodesFunction<T = unknown> = (
  projectConfigurationFile: string,
  options: T | undefined,
  context: CreateNodesContext
) => CreateNodesResult | Promise<CreateNodesResult>;

export interface CreateNodesResult {
  /**
   * A map of project root -> project configuration
   */
  projects?: Record<string, Optional<ProjectConfiguration, 'root'>>;

  /**
   * A map of external node name -> external node. External nodes do not have a root, so the key is their name.
   */
  externalNodes?: Record<string, ProjectGraphExternalNode>;
}

/**
 * A pair of file patterns and {@link CreateNodesFunction}
 */
export type CreateNodes<T = unknown> = readonly [
  projectFilePattern: string,
  createNodesFunction: CreateNodesFunction<T>
];

/**
 * Context for {@link CreateDependencies}
 */
export interface CreateDependenciesContext {
  /**
   * The external nodes that have been added to the graph.
   */
  readonly externalNodes: ProjectGraph['externalNodes'];

  /**
   * The configuration of each project in the workspace.
   */
  readonly projects: Record<string, ProjectConfiguration>;

  /**
   * The `nx.json` configuration from the workspace
   */
  readonly nxJsonConfiguration: NxJsonConfiguration;

  /**
   * All files in the workspace
   */
  readonly fileMap: FileMap;

  /**
   * Files changes since last invocation
   */
  readonly filesToProcess: FileMap;

  readonly workspaceRoot: string;
}

/**
 * A function which parses files in the workspace to create dependencies in the {@link ProjectGraph}
 * Use {@link validateDependency} to validate dependencies
 */
export type CreateDependencies<T = unknown> = (
  options: T | undefined,
  context: CreateDependenciesContext
) => RawProjectGraphDependency[] | Promise<RawProjectGraphDependency[]>;

/**
 * A plugin for Nx which creates nodes and dependencies for the {@link ProjectGraph}
 */
export type NxPluginV2<TOptions = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   */
  createNodes?: CreateNodes;

  // Todo(@AgentEnder): This shouldn't be a full processor, since its only responsible for defining edges between projects. What do we want the API to be?
  /**
   * Provides a function to analyze files to create dependencies for the {@link ProjectGraph}
   */
  createDependencies?: CreateDependencies<TOptions>;
};

/**
 * A plugin for Nx
 */
export type NxPlugin = NxPluginV1 | NxPluginV2;

export type LoadedNxPlugin = {
  plugin: NxPluginV2 & Pick<NxPluginV1, 'processProjectGraph'>;
  options?: unknown;
};

export type CreateNodesResultWithContext = CreateNodesResult & {
  file: string;
  pluginName: string;
};

export type RemotePlugin = Omit<LoadedNxPlugin['plugin'], 'createNodes'> & {
  createNodes: [
    filePattern: string,
    fn: (
      matchedFiles: string[],
      context: CreateNodesContext
    ) => Promise<CreateNodesResultWithContext[]>
  ];
};

// Short lived cache (cleared between cmd runs)
// holding resolved nx plugin objects.
// Allows loaded plugins to not be reloaded when
// referenced multiple times.
export const nxPluginCache: Map<unknown, RemotePlugin> = new Map();

export async function loadNxPlugins(
  plugins: PluginConfiguration[],
  root = workspaceRoot
): Promise<RemotePlugin[]> {
  const result: Promise<RemotePlugin>[] = [];

  plugins ??= [];

  plugins.unshift(
    join(
      __dirname,
      '../../plugins/project-json/build-nodes/package-json-next-to-project-json'
    )
  );

  // We push the nx core node plugins onto the end, s.t. it overwrites any other plugins
  plugins.push(...(await getDefaultPlugins(root)));

  for (const plugin of plugins) {
    result.push(loadNxPlugin(plugin, root));
  }

  return Promise.all(result);
}

export async function loadNxPlugin(
  plugin: PluginConfiguration,
  root = workspaceRoot
): Promise<RemotePlugin> {
  const cacheKey = JSON.stringify(plugin);

  if (nxPluginCache.has(cacheKey)) {
    return nxPluginCache.get(cacheKey)!;
  }

  const loadedPlugin = await loadRemoteNxPlugin(plugin, root);
  nxPluginCache.set(cacheKey, loadedPlugin);
  return loadedPlugin;
}

export function isNxPluginV2(plugin: NxPlugin): plugin is NxPluginV2 {
  return 'createNodes' in plugin || 'createDependencies' in plugin;
}

export function isNxPluginV1(
  plugin: NxPlugin | RemotePlugin
): plugin is NxPluginV1 {
  return 'processProjectGraph' in plugin || 'projectFilePatterns' in plugin;
}

export async function getDefaultPlugins(root: string) {
  return [
    join(__dirname, '../../plugins/js'),
    join(__dirname, '../../plugins/target-defaults/target-defaults-plugin'),
    ...(shouldMergeAngularProjects(root, false)
      ? [join(__dirname, '../../adapter/angular-json')]
      : []),
    join(__dirname, '../../plugins/package-json-workspaces'),
    join(__dirname, '../../plugins/project-json/build-nodes/project-json'),
  ];
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
