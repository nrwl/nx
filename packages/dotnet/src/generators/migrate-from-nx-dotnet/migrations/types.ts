import { NxJsonConfiguration, Tree } from '@nx/devkit';

export interface NxDotnetConfig {
  solutionFile?: string;
  inferProjects?: boolean;
  inferredTargets?: Record<string, any>;
  ignorePaths?: string[];
  moduleBoundaries?: Array<{
    sourceTag: string;
    onlyDependOnLibsWithTags?: string[];
    notDependOnLibsWithTags?: string[];
  }>;
  nugetPackages?: Record<string, string>;
  tags?: string[];
}

export interface MigrationStep {
  completed: string[];
  manualSteps: string[];
}

export interface MigrationContext {
  tree: Tree;
  rcConfig: NxDotnetConfig;
  nxJson: NxJsonConfiguration;
  dotnetPlugin: any;
}
