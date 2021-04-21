import { TargetDependencyConfig } from './workspace';

export type ImplicitDependencyEntry<T = '*' | string[]> = {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
};

export interface ImplicitJsonSubsetDependency<T = '*' | string[]> {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
}

export interface NxAffectedConfig {
  /**
   * Default based branch used by affected commands.
   */
  defaultBase?: string;
}

/**
 * Nx.json configuration
 */
export interface NxJsonConfiguration<T = '*' | string[]> {
  /**
   * Map of files to projects that implicitly depend on them
   */
  implicitDependencies?: ImplicitDependencyEntry<T>;
  /**
   * Dependencies between different target names across all projects
   */
  targetDependencies?: Record<string, TargetDependencyConfig[]>;
  /**
   * NPM Scope that the workspace uses
   */
  npmScope: string;
  /**
   * Default options for `nx affected`
   */
  affected?: NxAffectedConfig;
  /**
   * Configuration for projects
   */
  projects: {
    [projectName: string]: NxJsonProjectConfiguration;
  };
  workspaceLayout?: {
    libsDir: string;
    appsDir: string;
  };
  /**
   * Available Task Runners
   */
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      /**
       * Path to resolve the runner
       */
      runner: string;
      /**
       * Default options for the runner
       */
      options?: any;
    };
  };
  /**
   * Plugins for extending the project graph
   */
  plugins?: string[];
}

export interface NxJsonProjectConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
}
