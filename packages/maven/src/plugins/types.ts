import { TargetConfiguration, ProjectConfiguration } from '@nx/devkit';

export interface MavenPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  verbose?: boolean;
  atomizeTests?: boolean;
  minTestClassesForAtomization?: number;
}

export const DEFAULT_OPTIONS: MavenPluginOptions = {
  atomizeTests: false,
  minTestClassesForAtomization: 1
};

// All Maven-specific types are now handled in the Kotlin analyzer
// TypeScript only needs the final Nx format using official @nx/devkit types

export interface MavenAnalysisData {
  createNodesResults: CreateNodesResult[];
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
}

// Nx-specific types for the createNodesResults format using official types
export type CreateNodesResult = [string, ProjectsWrapper]; // [root path, projects wrapper]

export interface ProjectsWrapper {
  projects: Record<string, ProjectConfiguration>;
}