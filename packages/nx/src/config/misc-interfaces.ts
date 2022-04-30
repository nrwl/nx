import { Hash, Hasher } from '../hasher/hasher';
import { ProjectGraph } from './project-graph';
import { Task, TaskGraph } from './task-graph';
import {
  TargetConfiguration,
  WorkspaceJsonConfiguration,
} from './workspace-json-project-json';

import type { NxJsonConfiguration } from './nx-json';
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

export interface GeneratorsJsonEntry {
  schema: string;
  implementation?: string;
  factory?: string;
  description?: string;
  aliases?: string[];
  cli?: 'nx';
  'x-type'?: 'library' | 'application';
}

export interface ExecutorsJsonEntry {
  schema: string;
  implementation: string;
  batchImplementation?: string;
  description?: string;
  hasher?: string;
}

export type Dependencies = 'dependencies' | 'devDependencies';

export interface PackageJsonUpdateForPackage {
  version: string;
  ifPackageInstalled?: string;
  alwaysAddToPackageJson?: boolean | Dependencies;
  addToPackageJson?: boolean | Dependencies;
}

export type PackageJsonUpdates = {
  [name: string]: {
    version: string;
    packages: {
      [packageName: string]: PackageJsonUpdateForPackage;
    };
  };
};

export interface MigrationsJsonEntry {
  version: string;
  description?: string;
  cli?: string;
  implementation?: string;
  factory?: string;
}

export interface MigrationsJson {
  version: string;
  collection?: string;
  generators?: { [name: string]: MigrationsJsonEntry };
  schematics?: { [name: string]: MigrationsJsonEntry };
  packageJsonUpdates?: PackageJsonUpdates;
}

export interface GeneratorsJson {
  extends?: string;
  schematics?: Record<string, GeneratorsJsonEntry>;
  generators?: Record<string, GeneratorsJsonEntry>;
}

export interface ExecutorsJson {
  executors?: Record<string, ExecutorsJsonEntry>;
  builders?: Record<string, ExecutorsJsonEntry>;
}

export interface ExecutorConfig {
  schema: any;
  hasherFactory?: () => CustomHasher;
  implementationFactory: () => Promise<Executor>;
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

export interface HasherContext {
  hasher: Hasher;
  projectGraph: ProjectGraph<any>;
  taskGraph: TaskGraph;
  workspaceConfig: WorkspaceJsonConfiguration & NxJsonConfiguration;
}

export type CustomHasher = (
  task: Task,
  context: HasherContext
) => Promise<Hash>;

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
