import { WorkspaceResults } from '@nrwl/workspace/src/command-line/workspace-results';
import { workspaces } from '@angular-devkit/core';

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

export interface NxWorkspaceJsonProjectDefinition<P = string> {
  root: P;
  sourceRoot: P;
  projectType: 'library' | 'application';

  schematic: EmptyMap | AnyStringMap;
  architect: Record<string, workspaces.TargetDefinition>;
}

export interface NxWorkspaceJson<P = string> {
  version: number;
  projects: Record<string, NxWorkspaceJsonProjectDefinition<P>>;
  cli: { defaultCollection: string };

  schematics: Record<string, AnyStringMap<AnyStringMap>>;
  defaultProject?: string;
}

type AnyStringMap<V = any> = Record<string, V>;
type EmptyMap = Record<string, never>;

export interface NxPackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  author?: string;
  license?: string;
  private: boolean;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [k: string]: unknown;
}
