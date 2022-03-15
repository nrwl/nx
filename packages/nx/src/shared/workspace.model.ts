import { NxJsonConfiguration } from './nx';
import { TaskGraph } from './tasks';

export interface Workspace
  extends WorkspaceJsonConfiguration,
    NxJsonConfiguration {
  projects: Record<string, ProjectConfiguration>;
}

/**
 * Workspace configuration
 */
export interface WorkspaceJsonConfiguration {
  /**
   * Version of the configuration format
   */
  version: number;
  /**
   * Projects' projects
   */
  projects: {
    [projectName: string]: ProjectConfiguration;
  };
}

export interface RawWorkspaceJsonConfiguration
  extends Omit<WorkspaceJsonConfiguration, 'projects'> {
  projects: { [projectName: string]: ProjectConfiguration | string };
}

/**
 * Type of project supported
 */
export type ProjectType = 'library' | 'application';

/**
 * Project configuration
 */
export interface ProjectConfiguration {
  /**
   * Project's name. Optional if specified in workspace.json
   */
  name?: string;

  /**
   * Project's targets
   */
  targets?: { [targetName: string]: TargetConfiguration };

  /**
   * Project's location relative to the root of the workspace
   */
  root: string;

  /**
   * The location of project's sources relative to the root of the workspace
   */
  sourceRoot?: string;

  /**
   * Project type
   */
  projectType?: ProjectType;

  /**
   * List of default values used by generators.
   *
   * These defaults are project specific.
   *
   * Example:
   *
   * ```
   * {
   *   "@nrwl/react": {
   *     "library": {
   *       "style": "scss"
   *     }
   *   }
   * }
   * ```
   */
  generators?: { [collectionName: string]: { [generatorName: string]: any } };

  /**
   * List of projects which are added as a dependency
   */
  implicitDependencies?: string[];

  /**
   * List of tags used by nx-enforce-module-boundaries / project graph
   */
  tags?: string[];
}

export interface TargetDependencyConfig {
  /**
   * This the projects that the targets belong to
   *
   * 'self': This target depends on another target of the same project
   * 'deps': This target depends on targets of the projects of it's deps.
   */
  projects: 'self' | 'dependencies';

  /**
   * The name of the target
   */
  target: string;
}

/**
 * Target's configuration
 */
export interface TargetConfiguration {
  /**
   * The executor/builder used to implement the target.
   *
   * Example: '@nrwl/web:rollup'
   */
  executor: string;

  /**
   * List of the target's outputs. The outputs will be cached by the Nx computation
   * caching engine.
   */
  outputs?: string[];

  /**
   * This describes other targets that a target depends on.
   */
  dependsOn?: TargetDependencyConfig[];

  /**
   * Target's options. They are passed in to the executor.
   */
  options?: any;

  /**
   * Sets of options
   */
  configurations?: { [config: string]: any };

  /**
   * A default named configuration to use when a target configuration is not provided.
   */
  defaultConfiguration?: string;
}

/**
 * A callback function that is executed after changes are made to the file system
 */
export type GeneratorCallback = () => void | Promise<void>;

/**
 * A function that schedules updates to the filesystem to be done atomically
 */
export type Generator<T = unknown> = (
  tree,
  schema: T
) => void | GeneratorCallback | Promise<void | GeneratorCallback>;

export interface ExecutorConfig {
  schema: any;
  hasherFactory?: () => any;
  implementationFactory: () => Executor;
  batchImplementationFactory?: () => TaskGraphExecutor;
}

/**
 * Implementation of a target of a project
 */
export type Executor<T = any> = (
  /**
   * Options that users configure or pass via the command line
   */
  options: T,
  context: ExecutorContext
) =>
  | Promise<{ success: boolean }>
  | AsyncIterableIterator<{ success: boolean }>;

/**
 * Implementation of a target of a project that handles multiple projects to be batched
 */
export type TaskGraphExecutor<T = any> = (
  /**
   * Graph of Tasks to be executed
   */
  taskGraph: TaskGraph,
  /**
   * Map of Task IDs to options for the task
   */
  options: Record<string, T>,
  /**
   * Set of overrides for the overall execution
   */
  overrides: T,
  context: ExecutorContext
) => Promise<Record<string, { success: boolean; terminalOutput: string }>>;

/**
 * Context that is passed into an executor
 */
export interface ExecutorContext {
  /**
   * The root of the workspace
   */
  root: string;

  /**
   * The name of the project being executed on
   */
  projectName?: string;

  /**
   * The name of the target being executed
   */
  targetName?: string;

  /**
   * The name of the configuration being executed
   */
  configurationName?: string;

  /**
   * The configuration of the target being executed
   */
  target?: TargetConfiguration;

  /**
   * The full workspace configuration
   */
  workspace: WorkspaceJsonConfiguration & NxJsonConfiguration;

  /**
   * The current working directory
   */
  cwd: string;

  /**
   * Enable verbose logging
   */
  isVerbose: boolean;
}
