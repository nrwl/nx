import { WorkspaceResults } from '@nrwl/workspace/src/command-line/workspace-results';

export type ImplicitDependencyEntry<T = '*' | string[]> = {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
};

export interface ImplicitJsonSubsetDependency<T = '*' | string[]> {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
}

export interface NxAffectedConfig {
  defaultBase?: string;
}

export interface NxJson<T = '*' | string[]> {
  implicitDependencies?: ImplicitDependencyEntry<T>;
  npmScope: string;
  affected?: NxAffectedConfig;
  projects: {
    [projectName: string]: NxJsonProjectConfig;
  };
  workspaceLayout?: {
    libsDir?: string;
    appsDir?: string;
  };
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      runner: string;
      options?: object;
    };
  };
}

export interface NxJsonProjectConfig {
  implicitDependencies?: string[];
  tags?: string[];
}

export interface Environment {
  nxJson: NxJson;
  workspaceJson: any;
  workspaceResults: WorkspaceResults;
}
