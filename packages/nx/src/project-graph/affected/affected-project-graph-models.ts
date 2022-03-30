import type { Change, FileChange } from '../file-utils';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';

export interface AffectedProjectGraphContext {
  workspaceJson: any;
  nxJson: NxJsonConfiguration<string[]>;
  touchedProjects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    workspaceJson?: any,
    nxJson?: NxJsonConfiguration<string[]>,
    packageJson?: any,
    projectGraph?: ProjectGraph
  ): string[];
}
