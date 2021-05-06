import { NxJson } from '../shared-interfaces';
import { Change, FileChange } from '../file-utils';
import { ProjectGraph } from '../project-graph';

export interface AffectedProjectGraphContext {
  workspaceJson: any;
  nxJson: NxJson<string[]>;
  touchedProjects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    workspaceJson?: any,
    nxJson?: NxJson<string[]>,
    packageJson?: any,
    projectGraph?: ProjectGraph
  ): string[];
}
