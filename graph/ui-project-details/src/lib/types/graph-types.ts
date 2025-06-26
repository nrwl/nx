// Local type definitions to avoid circular dependency with @nx/devkit

export interface TargetDependencyConfig {
  target: string;
  params?: 'ignore' | 'forward';
  projects?: string | string[];
}

export interface TargetConfiguration {
  executor?: string;
  command?: string;
  options?: Record<string, any>;
  configurations?: Record<string, Record<string, any>>;
  dependsOn?: Array<string | TargetDependencyConfig>;
  inputs?: Array<string | Record<string, any>>;
  outputs?: string[];
  cache?: boolean;
  metadata?: Record<string, any>;
  defaultConfiguration?: string;
  parallelism?: boolean;
  syncGenerators?: string[];
}

export interface ProjectGraphProjectNode {
  type: 'lib' | 'app' | 'e2e';
  name: string;
  data: {
    root: string;
    sourceRoot?: string;
    projectType?: 'application' | 'library';
    targets?: Record<string, TargetConfiguration>;
    tags?: string[];
    metadata?: Record<string, any>;
  };
}
