import { Arguments as YargsArguments } from 'yargs';

export type ImplicitDependencyEntry = {
  [key: string]: ImpliedDependentProjects | ImplicitJsonSubsetDependency;
};

export type NormalizedImplicitDependencyEntry = { [key: string]: string[] };

export type ImplicitDependencies = {
  files: NormalizedImplicitDependencyEntry;
  projects: NormalizedImplicitDependencyEntry;
};

type ImpliedDependentProjects = '*' | string[];

interface ImplicitJsonSubsetDependency {
  [key: string]: ImpliedDependentProjects | ImplicitJsonSubsetDependency;
}

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

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib'
}

export type ProjectNode = {
  name: string;
  root: string;
  type: ProjectType;
  tags: string[];
  files: string[];
  architect: { [k: string]: any };
  implicitDependencies: string[];
  fileMTimes: {
    [filePath: string]: number;
  };
};

export interface ProjectMap {
  [projectName: string]: ProjectNode;
}
export type Dependencies = Record<string, Dependency[]>;

export type Dependency = { projectName: string; type: DependencyType };

export enum DependencyType {
  es6Import = 'es6Import',
  loadChildren = 'loadChildren',
  implicit = 'implicit',
  nodeModule = 'nodeModule'
}

export interface DependencyGraph {
  projects: ProjectMap;
  dependencies: Dependencies;
  roots: string[];
  reverseDependencies: Record<string, string[]>;
}

export type NxDepsJson = {
  dependencies: Dependencies;
  files: Dependencies;
};

// The package.json properties we care about.
export interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface YargsAffectedOptions extends YargsArguments, AffectedOptions {}

export interface AffectedOptions {
  target?: string;
  configuration?: string;
  runner?: string;
  parallel?: boolean;
  maxParallel?: number;
  untracked?: boolean;
  uncommitted?: boolean;
  all?: boolean;
  base?: string;
  head?: string;
  exclude?: string[];
  files?: string[];
  onlyFailed?: boolean;
  'only-failed'?: boolean;
  'max-parallel'?: boolean;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  quiet?: boolean;
  plain?: boolean;
  withDeps?: boolean;
}
