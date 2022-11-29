import type { Change, FileChange } from '../file-utils';
import { NxConfig } from '../../config/nx-config';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-config-project-config';

export interface AffectedProjectGraphContext {
  projectGraphNodes: Record<
    string,
    ProjectGraphProjectNode<ProjectConfiguration>
  >;
  nxConfig: NxConfig<any>;
  touchedProjects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    projectGraphNodes?: Record<
      string,
      ProjectGraphProjectNode<ProjectConfiguration>
    >,
    nxConfig?: NxConfig<any>,
    packageJson?: any,
    projectGraph?: ProjectGraph
  ): string[];
}
