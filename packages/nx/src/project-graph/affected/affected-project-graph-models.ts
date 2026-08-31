import type { Change, FileChange } from '../file-utils';
import type { TouchedProject } from './affected-reasons';
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
  /** Ecosystems whose manifest changed without the change being pinnable to
   * packages, so every node of that type counts as moved. A locator names the
   * ecosystem it reads, since a change to one cannot move another's nodes. */
  changedExternalTypes: string[];
  /** Workspace projects the change names outright, with why. */
  projects: TouchedProject[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    projectGraphNodes?: Record<string, ProjectGraphProjectNode>,
    nxJson?: NxJsonConfiguration<any>,
    packageJson?: any,
    projectGraph?: ProjectGraph,
    projectDeletionAffectsAllProjects?: boolean
  ): TouchedProject[] | Promise<TouchedProject[]>;
}
