import type { NxJsonConfiguration } from './nx-json';

/**
 * @deprecated use ProjectsConfigurations or NxJsonConfiguration
 */
export interface Workspace extends ProjectsConfigurations, NxJsonConfiguration {
  projects: Record<string, ProjectConfiguration>;
}

/**
 * @deprecated use ProjectsConfigurations
 */
export type WorkspaceJsonConfiguration = ProjectsConfigurations;

/**
 * Projects Configurations
 * @note: when adding properties here add them to `allowedWorkspaceExtensions` in adapter/compat.ts
 */
export interface ProjectsConfigurations {
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

/**
 * Type of project supported
 */
export type ProjectType = 'library' | 'application';

/**
 * Project configuration
 *
 * @note: when adding properties here add them to `allowedProjectExtensions` in adapter/compat.ts
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
   *   "@nx/react": {
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
   * Named inputs targets can refer to reduce duplication
   */
  namedInputs?: { [inputName: string]: (string | InputDefinition)[] };

  /**
   * List of tags used by enforce-module-boundaries / project graph
   */
  tags?: string[];
}

export interface TargetDependencyConfig {
  /**
   * A list of projects that have `target`.
   * Should not be specified together with `dependencies`.
   */
  projects?: string[] | string;

  /**
   * If true, the target will be executed for each project that this project depends on.
   * Should not be specified together with `projects`.
   */
  dependencies?: boolean;

  /**
   * The name of the target to run. If `projects` and `dependencies` are not specified,
   * the target will be executed for the same project the the current target is running on`.
   */
  target: string;

  /**
   * Configuration for params handling.
   */
  params?: 'ignore' | 'forward';
}

export type InputDefinition =
  | { input: string; projects: string | string[] }
  | { input: string; dependencies: true }
  | { input: string }
  | { fileset: string }
  | { runtime: string }
  | { externalDependencies: string[] }
  | { dependentTasksOutputFiles: string; transitive?: boolean }
  | { env: string };

/**
 * Target's configuration
 */
export interface TargetConfiguration<T = any> {
  /**
   * The executor/builder used to implement the target.
   *
   * Example: '@nx/rollup:rollup'
   */
  executor?: string;

  /**
   * Used as a shorthand for nx:run-commands, a command to run.
   */
  command?: string;

  /**
   * List of the target's outputs. The outputs will be cached by the Nx computation
   * caching engine.
   */
  outputs?: string[];

  /**
   * This describes other targets that a target depends on.
   */
  dependsOn?: (TargetDependencyConfig | string)[];

  /**
   * This describes filesets, runtime dependencies and other inputs that a target depends on.
   */
  inputs?: (InputDefinition | string)[];

  /**
   * Target's options. They are passed in to the executor.
   */
  options?: T;

  /**
   * Sets of options
   */
  configurations?: { [config: string]: any };

  /**
   * A default named configuration to use when a target configuration is not provided.
   */
  defaultConfiguration?: string;
}
