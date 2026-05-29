import { Hash, TaskHasher } from '../hasher/task-hasher';
import { ProjectGraph } from './project-graph';
import { Task, TaskGraph } from './task-graph';
import {
  TargetConfiguration,
  ProjectsConfigurations,
} from './workspace-json-project-json';

import type { NxJsonConfiguration } from './nx-json';
import type { Schema } from '../utils/params';
import type { Tree } from '../generators/tree';
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
  hidden?: boolean;
  schema: string;
  implementation?: string;
  factory?: string;
  description?: string;
  aliases?: string[];
  cli?: 'nx';
  'x-type'?: 'library' | 'application';
  'x-deprecated'?: string;
  // @todo(v17) Remove this and make it default behavior.
  'x-use-standalone-layout'?: boolean;
}

export type OutputCaptureMethod = 'direct-nodejs' | 'pipe';

export interface ExecutorJsonEntryConfig {
  schema: string;
  implementation: string;
  batchImplementation?: string;
  preferBatch?: boolean;
  description?: string;
  hasher?: string;
}
export type ExecutorsJsonEntry = string | ExecutorJsonEntryConfig;

export type Dependencies = 'dependencies' | 'devDependencies';

export interface PackageJsonUpdateForPackage {
  version: string;
  ifPackageInstalled?: string;
  alwaysAddToPackageJson?: boolean | Dependencies;
  addToPackageJson?: boolean | Dependencies;
  ignorePackageGroup?: boolean;
  ignoreMigrations?: boolean;
}

export type PackageJsonUpdates = {
  [name: string]: {
    version: string;
    packages: {
      [packageName: string]: PackageJsonUpdateForPackage;
    };
    'x-prompt'?: string;
    requires?: Record<string, string>;
    incompatibleWith?: Record<string, string>;
  };
};

/**
 * Represents a migration that is executed when running `nx migrate`.
 *
 * Returning a string[] from the migration function will be interpreted as
 * a list of next steps to be displayed to the user.
 */
/**
 * Structured return value for a migration function.
 *
 * - `nextSteps`: workspace-wide notes surfaced to the human in the `nx migrate`
 *   post-run summary. Same audience as the legacy `string[]` return.
 * - `agentContext`: for hybrid migrations (`implementation` + `prompt`). When the
 *   paired prompt runs under `--agentic`, these strings are delivered to the
 *   agent as part of its outer prompt. When no agent runs, this bucket is
 *   silently dropped — it is agent-only by contract. Content meant for the
 *   human in any scenario belongs in `nextSteps`.
 */
export interface MigrationReturnObject {
  nextSteps?: string[];
  agentContext?: string[];
}

export type Migration = (
  tree: Tree
) =>
  | void
  | string[]
  | MigrationReturnObject
  | Promise<void | string[] | MigrationReturnObject>;

export interface MigrationsJsonEntry {
  version: string;
  description?: string;
  implementation?: string;
  factory?: string;
  prompt?: string;
  requires?: Record<string, string>;
  /**
   * Path to a markdown doc describing the migration, relative to the
   * `migrations.json` and resolved like `implementation`/`factory`. Always
   * supplementary; never stands in for them. Under `--run-migrations
   * --agentic` the resolved path is passed to the agent as extra context.
   */
  docs?: string;
}

export type MigrationDetailsWithId = GeneratedMigrationDetails & {
  id: string;
};
export interface GeneratedMigrationDetails {
  name: string;
  version: string;
  package: string;
  description: string;
  implementation?: string;
  prompt?: string;
}

export interface MigrationsJson {
  name?: string;
  version?: string;
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
  schema: {
    version?: number;
    outputCapture?: OutputCaptureMethod;
    continuous?: boolean;
  } & Schema;
  hasherFactory?: () => CustomHasher;
  implementationFactory: () => Executor;
  batchImplementationFactory?: () => TaskGraphExecutor;
  preferBatch?: boolean;
}

/**
 * An executor implementation that returns a promise
 */
export type PromiseExecutor<T = any> = (
  /**
   * Options that users configure or pass via the command line
   */
  options: T,
  context: ExecutorContext
) => Promise<{ success: boolean }>;

/**
 * An executor implementation that returns an async iterator
 */
export type AsyncIteratorExecutor<T = any> = (
  /**
   * Options that users configure or pass via the command line
   */
  options: T,
  context: ExecutorContext
) => AsyncIterableIterator<{ success: boolean }>;

/**
 * Implementation of a target of a project
 */
export type Executor<T = any> = PromiseExecutor<T> | AsyncIteratorExecutor<T>;

export interface HasherContext {
  hasher: TaskHasher;
  projectGraph: ProjectGraph;
  taskGraph: TaskGraph;
  projectsConfigurations: ProjectsConfigurations;
  nxJsonConfiguration: NxJsonConfiguration;
}

export type CustomHasher = (
  task: Task,
  context: HasherContext
) => Promise<Hash>;

export type TaskResult = {
  success: boolean;
  terminalOutput: string;
  startTime?: number;
  endTime?: number;
  /**
   * Explicit status. When set, takes precedence over `success`. Required for
   * batch executors that need to distinguish `'skipped'` peers (tasks that
   * never ran because a sibling failed) from real failures.
   */
  status?: 'success' | 'failure' | 'skipped';
};
export type BatchExecutorResult = Record<string, TaskResult>;
export type BatchExecutorTaskResult = {
  task: string;
  result: TaskResult;
};

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
) => Promise<
  BatchExecutorResult | AsyncIterableIterator<BatchExecutorTaskResult>
>;

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
   * Projects config
   */
  projectsConfigurations: ProjectsConfigurations;

  /**
   * The contents of nx.json.
   */
  nxJsonConfiguration: NxJsonConfiguration;

  /**
   * The current working directory
   */
  cwd: string;

  /**
   * Enable verbose logging
   */
  isVerbose: boolean;

  /**
   * A snapshot of the project graph as
   * it existed when the Nx command was kicked off
   */
  projectGraph: ProjectGraph;

  /**
   * A snapshot of the task graph as
   * it existed when the Nx command was kicked off
   */
  taskGraph?: TaskGraph;
}
