import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getLatestGitTagForPattern } from '../utils/git';
import { ProjectLogger } from './project-logger';
import type { FinalConfigForProject } from '../utils/release-graph';
import { VersionActions } from './version-actions';
export declare function resolveCurrentVersion(tree: Tree, projectGraphNode: ProjectGraphProjectNode, releaseGroup: ReleaseGroupWithName, versionActions: VersionActions, logger: ProjectLogger, cachedCurrentVersionsPerFixedReleaseGroup: Map<string, // release group name
{
    currentVersion: string;
    originatingProjectName: string;
    logText: string;
}>, finalConfigForProject: FinalConfigForProject, releaseTagPattern: string, latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>): Promise<string | null>;
/**
 * Attempt to resolve the current version from the manifest file on disk.
 *
 * Not all VersionActions implementations support a manifest file, in which case the logic will handle either thrown errors
 * or null values being returned from the readCurrentVersionFromSourceManifest method and throw a clear user-facing error.
 */
export declare function resolveCurrentVersionFromDisk(tree: Tree, projectGraphNode: ProjectGraphProjectNode, versionActions: VersionActions, logger: ProjectLogger): Promise<string>;
export declare function resolveCurrentVersionFromRegistry(tree: Tree, projectGraphNode: ProjectGraphProjectNode, releaseGroup: ReleaseGroupWithName, versionActions: VersionActions, logger: ProjectLogger, cachedCurrentVersionsPerFixedReleaseGroup: Map<string, // release group name
{
    currentVersion: string;
    originatingProjectName: string;
    logText?: string;
}>, finalConfigForProject: FinalConfigForProject): Promise<string>;
export declare function resolveCurrentVersionFromGitTag(tree: Tree, projectGraphNode: ProjectGraphProjectNode, releaseGroup: ReleaseGroupWithName, versionActions: VersionActions, logger: ProjectLogger, cachedCurrentVersionsPerFixedReleaseGroup: Map<string, // release group name
{
    currentVersion: string;
    originatingProjectName: string;
    logText: string;
}>, finalConfigForProject: FinalConfigForProject, releaseTagPattern: string, latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>): Promise<string>;
