import type { Change, FileChange } from '../file-utils';
import { NxJsonConfiguration } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';

export interface AffectedProjectGraphContext {
  projectGraphNodes: Record<
    string,
    ProjectGraphProjectNode<ProjectConfiguration>
  >;
  nxJson: NxJsonConfiguration<string[]>;
  touchedProjects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    projectGraphNodes?: Record<
      string,
      ProjectGraphProjectNode<ProjectConfiguration>
    >,
    nxJson?: NxJsonConfiguration<string[]>,
    packageJson?: any,
    projectGraph?: ProjectGraph
  ): string[];
}
