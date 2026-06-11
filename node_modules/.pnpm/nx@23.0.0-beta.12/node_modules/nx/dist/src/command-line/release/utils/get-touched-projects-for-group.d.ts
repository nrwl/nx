import { FileData, ProjectGraph } from '../../../config/project-graph';
import { NxArgs } from '../../../utils/command-line-utils';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
/**
 * Create a function that returns the touched projects for a given release group. Only relevant when version plans are enabled.
 */
export declare function createGetTouchedProjectsForGroup(nxArgs: NxArgs, projectGraph: ProjectGraph, changedFiles: string[], fileData: FileData[]): (releaseGroup: ReleaseGroupWithName, releaseGroupFilteredProjectNames: string[], hasProjectsFilter: boolean) => Promise<string[]>;
