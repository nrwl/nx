import type { ProjectGraph, ProjectGraphProjectNode } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getLatestGitTagForPattern } from '../utils/git';
import { ReleaseGraph } from '../utils/release-graph';
import { ProjectLogger } from './project-logger';
import { SemverBumpType } from './version-actions';
export declare function deriveSpecifierFromConventionalCommits(nxReleaseConfig: NxReleaseConfig, projectGraph: ProjectGraph, projectLogger: ProjectLogger, releaseGroup: ReleaseGroupWithName, projectGraphNode: ProjectGraphProjectNode, isPrerelease: boolean, latestMatchingGitTag: Awaited<ReturnType<typeof getLatestGitTagForPattern>> | undefined, releaseGraph: ReleaseGraph, fallbackCurrentVersionResolver?: 'disk', preid?: string): Promise<SemverBumpType>;
