import type { NxJsonConfiguration } from './nx-json';

export interface Workspace extends ProjectsConfigurations, NxJsonConfiguration {
  projects: Record<string, ProjectConfiguration>;
}

/**
 * @deprecated use ProjectsConfigurations
 */
export type WorkspaceJsonConfiguration = ProjectsConfigurations;

/**
 * Projects Configurations
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

export interface RawProjectsConfigurations
  extends Omit<ProjectsConfigurations, 'projects'> {
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
   * Named inputs targets can refer to reduce duplication
   */
  namedInputs?: { [inputName: string]: (string | InputDefinition)[] };

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

  /**
   * Configuration for params handling.
   */
  params?: 'ignore' | 'forward';
}

export type InputDefinition =
  | { input: string; projects: 'self' | 'dependencies' }
  | { fileset: string }
  | { runtime: string }
  | { env: string };

/**
 * Target's configuration
 */
export interface TargetConfiguration<T = any> {
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
