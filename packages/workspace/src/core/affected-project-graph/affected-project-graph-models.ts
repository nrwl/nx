import type { NxJsonConfiguration, ProjectGraph } from '@nrwl/devkit';
import type { Change, FileChange } from '../file-utils';

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
