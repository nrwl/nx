export type ImplicitDependencyEntry = { [key: string]: '*' | string[] };

export interface NxJson {
  implicitDependencies?: ImplicitDependencyEntry;
  npmScope: string;
  projects: {
    [projectName: string]: NxJsonProjectConfig;
  };
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      runner: string;
      options?: unknown;
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
  workspace: any;
}
