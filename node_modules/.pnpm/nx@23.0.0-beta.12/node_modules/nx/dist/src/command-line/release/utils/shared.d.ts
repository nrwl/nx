import { ProjectGraph } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { GitCommit } from './git';
import { ReleaseGraph } from './release-graph';
export declare const noDiffInChangelogMessage: string;
export type VersionData = Record<string, VersionDataEntry>;
export interface VersionDataEntry {
    currentVersion: string;
    /**
     * newVersion will be null in the case that no changes are detected for the project,
     * e.g. when using conventional commits
     */
    newVersion: string | null;
    /**
     * dockerVersion will be populated if the project is a docker project and has been
     * included within this release.
     */
    dockerVersion?: string | null;
    /**
     * The list of projects which depend upon the current project.
     */
    dependentProjects: {
        source: string;
        target: string;
        type: string;
        dependencyCollection: string;
        rawVersionSpec: string;
    }[];
}
export declare function isPrerelease(version: string): boolean;
export declare class ReleaseVersion {
    rawVersion: string;
    gitTag: string;
    isPrerelease: boolean;
    constructor({ version, // short form version string with no prefixes or patterns, e.g. 1.0.0
    releaseTagPattern, // full pattern to interpolate, e.g. "v{version}" or "{projectName}@{version}"
    projectName, // optional project name to interpolate into the releaseTagPattern
    releaseGroupName, }: {
        version: string;
        releaseTagPattern: string;
        projectName?: string;
        releaseGroupName?: string;
    });
}
export declare function commitChanges({ changedFiles, deletedFiles, isDryRun, isVerbose, gitCommitMessages, gitCommitArgs, }: {
    changedFiles?: string[];
    deletedFiles?: string[];
    isDryRun?: boolean;
    isVerbose?: boolean;
    gitCommitMessages?: string[];
    gitCommitArgs?: string | string[];
}): Promise<void>;
export declare function createCommitMessageValues(releaseGroups: ReleaseGroupWithName[], releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>, versionData: VersionData, commitMessage: string): string[];
export declare function shouldPreferDockerVersionForReleaseGroup(releaseGroup: ReleaseGroupWithName): boolean | 'both';
export declare function shouldSkipVersionActions(dockerOptions: {
    skipVersionActions?: string[] | boolean;
}, projectName: string): boolean;
export declare function createGitTagValues(releaseGroups: ReleaseGroupWithName[], releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>, versionData: VersionData): string[];
export declare function handleDuplicateGitTags(gitTagValues: string[]): void;
export declare function getCommitsRelevantToProjects(projectGraph: ProjectGraph, commits: GitCommit[], projects: string[], nxReleaseConfig: NxReleaseConfig, releaseGraph: ReleaseGraph): Promise<Map<string, {
    commit: GitCommit;
    isProjectScopedCommit: boolean;
}[]>>;
