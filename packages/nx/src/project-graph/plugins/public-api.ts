// This file represents the public API for plugins which live in nx.json's plugins array.
// For methods to interact with plugins from within Nx, see `./internal-api.ts`.

import type {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

import type { NxJsonConfiguration } from '../../config/nx-json';
import type { TaskResults } from '../../tasks-runner/life-cycle';
import type { RawProjectGraphDependency } from '../project-graph-builder';

export interface CreateNodesContext {
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly workspaceRoot: string;
}

/**
 * @deprecated This will be removed in Nx 24. See {@link CreateNodesContext}
 */
export type CreateNodesContextV2 = CreateNodesContext;

export type CreateNodesResultArray = Array<
  readonly [configFileSource: string, result: CreateNodesResult]
>;

/**
 * @deprecated This will be removed in Nx 24. See {@link CreateNodesResultArray}
 */
export type CreateNodesResultV2 = CreateNodesResultArray;

export type CreateNodesFunction<T = unknown> = (
  projectConfigurationFiles: readonly string[],
  options: T | undefined,
  context: CreateNodesContext
) => CreateNodesResultArray | Promise<CreateNodesResultArray>;

/**
 * @deprecated see {@link CreateNodesFunction}
 */
export type CreateNodesFunctionV2<T = unknown> = CreateNodesFunction<T>;

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
 */
export type CreateNodes<T = unknown> = readonly [
  projectFilePattern: string,
  createNodesFunction: CreateNodesFunction<T>,
];

/**
 * @deprecated - use {@link CreateNodes} instead
 */
export type CreateNodesV2<T = unknown> = CreateNodes<T>;

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
export type NxPlugin<TOptions = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   */
  createNodes?: CreateNodes<TOptions>;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFiles }
   *
   * @deprecated Prefer `createNodes` for new plugins
   */
  createNodesV2?: CreateNodes<TOptions>;

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
 *
 * @deprecated See {@link NxPlugin}
 */
export type NxPluginV2<TOptions = unknown> = NxPlugin<TOptions>;
