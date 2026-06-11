import type { Change, FileChange } from '../file-utils';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph, ProjectGraphProjectNode } from '../../config/project-graph';
export interface AffectedProjectGraphContext {
    projectGraphNodes: Record<string, ProjectGraphProjectNode>;
    nxJson: NxJsonConfiguration<any>;
    touchedProjects: string[];
}
export interface TouchedProjectLocator<T extends Change = Change> {
    (fileChanges: FileChange<T>[], projectGraphNodes?: Record<string, ProjectGraphProjectNode>, nxJson?: NxJsonConfiguration<any>, packageJson?: any, projectGraph?: ProjectGraph): string[] | Promise<string[]>;
}
