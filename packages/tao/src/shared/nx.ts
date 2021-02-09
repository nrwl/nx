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
  implicitDependencies?: ImplicitDependencyEntry<T>;
  npmScope: string;
  affected?: NxAffectedConfig;
  projects: {
    [projectName: string]: NxJsonProjectConfiguration;
  };
  workspaceLayout?: {
    libsDir: string;
    appsDir: string;
  };
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      runner: string;
      options?: any;
    };
  };
}

export interface NxJsonProjectConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
}
