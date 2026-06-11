import type { ProjectGraphProjectNode } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import type { CreateDependenciesContext } from '../plugins';
import type { ProjectGraphBuilder } from '../project-graph-builder';
export declare function normalizeProjectNodes({ projects, workspaceRoot }: CreateDependenciesContext, builder: ProjectGraphBuilder): Promise<void>;
export declare function normalizeImplicitDependencies(source: string, implicitDependencies: ProjectConfiguration['implicitDependencies'], projects: Record<string, ProjectGraphProjectNode>): string[];
