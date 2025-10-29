// This file represents the public API for plugins which live in nx.json's plugins array.
// For methods to interact with plugins from within Nx, see `./internal-api.ts`.

import type {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

import type { NxJsonConfiguration } from '../../config/nx-json';
import type { RawProjectGraphDependency } from '../project-graph-builder';
import type { TaskResults } from '../../tasks-runner/life-cycle';

export interface CreateNodesContextV2 {
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly workspaceRoot: string;
  readonly additionalProjectConfigurationFiles?: string[];
}

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
 * A pair of file patterns and {@link CreateNodesFunctionV2}
 * In Nx 21 {@link CreateNodes} will be replaced with this type. In Nx 22, this type will be removed.
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
   * The configuration of each project in the workspace keyed by project name.
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
 * A plugin which enhances the behavior of Nx
 */
export type NxPluginV2<TOptions = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   */
  createNodes?: CreateNodesV2<TOptions>;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFiles }
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

  /**
   * Provides a function to run before the Nx runs tasks
   */
  preTasksExecution?: PreTasksExecution<TOptions>;

  /**
   * Provides a function to run after the Nx runs tasks
   */
  postTasksExecution?: PostTasksExecution<TOptions>;
};

export type PreTasksExecutionContext = {
  readonly id: string;
  readonly workspaceRoot: string;
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly argv: string[];
};
export type PostTasksExecutionContext = {
  readonly id: string;
  readonly workspaceRoot: string;
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly taskResults: TaskResults;
  readonly argv: string[];
  readonly startTime: number;
  readonly endTime: number;
};

export type PreTasksExecution<TOptions = unknown> = (
  options: TOptions | undefined,
  context: PreTasksExecutionContext
) => void | Promise<void>;
export type PostTasksExecution<TOptions = unknown> = (
  options: TOptions | undefined,
  context: PostTasksExecutionContext
) => void | Promise<void>;
/**
 * A plugin which enhances the behavior of Nx
 */
export type NxPlugin<TOptions = unknown> = NxPluginV2<TOptions>;
