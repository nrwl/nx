import type { Change, FileChange } from '../file-utils';
import { NxJsonConfiguration } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';

export interface AffectedProjectGraphContext {
  projectGraphNodes: Record<string, ProjectGraphProjectNode>;
  nxJson: NxJsonConfiguration<any>;
  touchedProjects: string[];
}

/**
 * What a lockfile or package.json change moved, before it is projected onto
 * projects (the reverse walk) or tasks (matched against each plan's externals).
 */
export interface DependencyChanges {
  /** External node names whose version or integrity moved. */
  externals: string[];
  /** The change could not be pinned to packages, so every external counts. */
  allExternals: boolean;
  /** Workspace projects the change names outright. */
  projects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    projectGraphNodes?: Record<string, ProjectGraphProjectNode>,
    nxJson?: NxJsonConfiguration<any>,
    packageJson?: any,
    projectGraph?: ProjectGraph,
    projectDeletionAffectsAllProjects?: boolean
  ): string[] | Promise<string[]>;
}
