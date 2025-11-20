import type { CreateNodesResultV2 } from '@nx/devkit';
import type { RawProjectGraphDependency } from 'nx/src/project-graph/project-graph-builder';

export interface MavenPluginOptions {
  verbose?: boolean;
  targetNamePrefix?: string;
}

export const DEFAULT_OPTIONS: MavenPluginOptions = {};

// All Maven-specific types are now handled in the Kotlin analyzer
// TypeScript only needs the final Nx format using official @nx/devkit types

export interface MavenAnalysisData {
  createNodesResults: CreateNodesResultV2;
  createDependenciesResults: RawProjectGraphDependency[];
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
}
