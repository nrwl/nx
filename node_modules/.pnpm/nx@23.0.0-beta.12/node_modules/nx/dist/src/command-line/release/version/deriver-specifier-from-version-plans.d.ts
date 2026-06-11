import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { SemverBumpType } from './version-actions';
import { ProjectLogger } from './project-logger';
export declare function deriveSpecifierFromVersionPlan(projectLogger: ProjectLogger, releaseGroup: ReleaseGroupWithName, projectGraphNode: ProjectGraphProjectNode, currentVersion: string): Promise<{
    bumpType: SemverBumpType;
    versionPlanPath: string;
}>;
