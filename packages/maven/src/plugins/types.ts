import type { CreateNodesResultArray } from '@nx/devkit';
import { type RawProjectGraphDependency } from '@nx/devkit';

export interface MavenPluginOptions {
  verbose?: boolean;
  targetNamePrefix?: string;
}

export const DEFAULT_OPTIONS: MavenPluginOptions = {};

// All Maven-specific types are now handled in the Kotlin analyzer
// TypeScript only needs the final Nx format using official @nx/devkit types

export interface MavenAnalysisData {
  createNodesResults: CreateNodesResultArray;
  createDependenciesResults: RawProjectGraphDependency[];
  generatedAt?: number;
  workspaceRoot?: string;
  totalProjects?: number;
}
