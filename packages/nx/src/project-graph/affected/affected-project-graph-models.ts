import type { Change, FileChange } from '../file-utils';
import { NxConfiguration } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

export interface AffectedProjectGraphContext {
  projectGraphNodes: Record<
    string,
    ProjectGraphProjectNode<ProjectConfiguration>
  >;
  nxConfig: NxConfiguration<any>;
  touchedProjects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    projectGraphNodes?: Record<
      string,
      ProjectGraphProjectNode<ProjectConfiguration>
    >,
    nxConfig?: NxConfiguration<any>,
    packageJson?: any,
    projectGraph?: ProjectGraph
  ): string[];
}
