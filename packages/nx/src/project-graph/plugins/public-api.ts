// This file represents the public API for plugins which live in nx.json's plugins array.
// For methods to interact with plugins from within Nx, see `./internal-api.ts`.

import { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';

import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { NxJsonConfiguration } from '../../config/nx-json';
import { RawProjectGraphDependency } from '../project-graph-builder';

/**
 * Context for {@link CreateNodesFunction}
 */
export interface CreateNodesContext extends CreateNodesContextV2 {
  /**
   * The subset of configuration files which match the createNodes pattern
   */
  readonly configFiles: readonly string[];
}

export interface CreateNodesContextV2 {
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

export type CreateNodesResultV2 = Array<
  readonly [configFileSource: string, result: CreateNodesResult]
>;

export type CreateNodesFunctionV2<T = unknown> = (
  projectConfigurationFiles: readonly string[],
  options: T | undefined,
  context: CreateNodesContextV2
) => CreateNodesResultV2 | Promise<CreateNodesResultV2>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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
 *
 * Nx 19.2+: Both original `CreateNodes` and `CreateNodesV2` are supported. Nx will only invoke `CreateNodesV2` if it is present.
 * Nx 20.X : The `CreateNodesV2` will be the only supported API. This typing will still exist, but be identical to `CreateNodesV2`.
             Nx **will not** invoke the original `plugin.createNodes` callback. This should give plugin authors a window to transition.
             Plugin authors should update their plugin's `createNodes` function to align with `CreateNodesV2` / the updated `CreateNodes`.
             The plugin should contain something like: `export createNodes = createNodesV2;` during this period. This will allow the plugin
             to maintain compatibility with Nx 19.2 and up.
 * Nx 21.X : The `CreateNodesV2` typing will be removed, as it has replaced `CreateNodes`.
 * 
 * @deprecated Use {@link CreateNodesV2} instead. CreateNodesV2 will replace this API. Read more about the transition above.
 */
export type CreateNodes<T = unknown> = readonly [
  projectFilePattern: string,
  createNodesFunction: CreateNodesFunction<T>
];

/**
 * A pair of file patterns and {@link CreateNodesFunctionV2}
 * In Nx 20 {@link CreateNodes} will be replaced with this type. In Nx 21, this type will be removed.
 */
export type CreateNodesV2<T = unknown> = readonly [
  projectFilePattern: string,
  createNodesFunction: CreateNodesFunctionV2<T>
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

export type CreateMetadataContext = {
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly workspaceRoot: string;
};

export type ProjectsMetadata = Record<
  string,
  Pick<ProjectConfiguration, 'metadata'>
>;

export type CreateMetadata<T = unknown> = (
  graph: ProjectGraph,
  options: T | undefined,
  context: CreateMetadataContext
) => ProjectsMetadata | Promise<ProjectsMetadata>;

/**
 * A plugin for Nx which creates nodes and dependencies for the {@link ProjectGraph}
 */
export type NxPluginV2<TOptions = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   *
   * @deprecated Use {@link createNodesV2} instead. In Nx 20 support for calling createNodes with a single file for the first argument will be removed.
   */
  createNodes?: CreateNodes<TOptions>;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFiles }
   *
   * In Nx 20 {@link createNodes} will be replaced with this property. In Nx 21, this property will be removed.
   */
  createNodesV2?: CreateNodesV2<TOptions>;

  /**
   * Provides a function to analyze files to create dependencies for the {@link ProjectGraph}
   */
  createDependencies?: CreateDependencies<TOptions>;

  /**
   * Provides a function to create metadata for the {@link ProjectGraph}
   */
  createMetadata?: CreateMetadata<TOptions>;
};

/**
 * A plugin for Nx
 */
export type NxPlugin = NxPluginV1 | NxPluginV2;
