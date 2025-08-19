export interface MavenPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  verbose?: boolean;
}

export const DEFAULT_OPTIONS: MavenPluginOptions = {};

export interface MavenProject {
  artifactId: string;
  groupId: string;
  version: string;
  packaging: string;
  name?: string;
  description?: string;
  root: string;
  sourceRoot?: string;
  hasTests?: boolean;
  hasResources?: boolean;
  projectType?: string;
  tags?: string[];
  dependencies?: MavenDependency[];
  parent?: MavenParent;
  lifecycle?: MavenLifecycle;
  modules?: string[];
}

export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version: string;
  scope?: string;
}

export interface MavenParent {
  groupId: string;
  artifactId: string;
  version: string;
}

export interface MavenLifecycle {
  phases?: string[];
  commonPhases?: string[];
  goals?: MavenGoal[];
  plugins?: MavenPluginInfo[];
}

export interface MavenGoal {
  plugin: string;
  goal: string;
  phase?: string;
}

export interface MavenPluginInfo {
  groupId: string;
  artifactId: string;
  version?: string;
  executions?: MavenExecution[];
}

export interface MavenExecution {
  id: string;
  phase?: string;
  goals: string[];
}

export interface MavenAnalysisData {
  projects: MavenProject[];
  coordinatesToProjectName?: Record<string, string>;
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
  createNodesResults?: CreateNodesResult[];
}

// Nx-specific types for the createNodesResults format
export type CreateNodesResult = [string, ProjectsWrapper]; // [root path, projects wrapper]

export interface ProjectsWrapper {
  projects: Record<string, NxProjectConfiguration>;
}

export interface NxProjectConfiguration {
  name: string;
  root: string;
  projectType: 'library' | 'application';
  sourceRoot?: string;
  targets: Record<string, NxTargetConfiguration>;
  tags?: string[];
}

export interface NxTargetConfiguration {
  executor: string;
  options: NxTargetOptions;
  dependsOn?: string[];
}

export interface NxTargetOptions {
  command: string;
  cwd: string;
}