import {
  TargetConfiguration,
  ProjectConfiguration,
  CreateDependencies,
  CreateNodesResultV2,
} from '@nx/devkit';
import { PluginCreateDependenciesResult } from 'nx/src/project-graph/plugins/isolation/messaging';
import type { RawProjectGraphDependency } from 'nx/src/project-graph/project-graph-builder';

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
  minTestClassesForAtomization: 1,
};

// All Maven-specific types are now handled in the Kotlin analyzer
// TypeScript only needs the final Nx format using official @nx/devkit types

export interface MavenAnalysisData {
  createNodesResults: CreateNodesResultV2;
  createDependenciesResults: RawProjectGraphDependency[];
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
}

// Nx-specific types for the createNodesResults format using official types

export interface ProjectsWrapper {
  projects: Record<string, ProjectConfiguration>;
}
