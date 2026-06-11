import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { ProjectGraphBuilder } from '../project-graph-builder';
export declare function applyImplicitDependencies(projects: Record<string, ProjectConfiguration>, builder: ProjectGraphBuilder): void;
