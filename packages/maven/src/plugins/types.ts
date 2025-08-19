export interface MavenPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  verbose?: boolean;
}

export const DEFAULT_OPTIONS: MavenPluginOptions = {};

// All Maven-specific types are now handled in the Kotlin analyzer
// TypeScript only needs the final Nx format

export interface MavenAnalysisData {
  createNodesResults: CreateNodesResult[];
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
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