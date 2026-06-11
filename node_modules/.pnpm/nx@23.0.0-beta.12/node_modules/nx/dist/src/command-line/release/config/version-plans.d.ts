import { ReleaseType } from 'semver';
import { RawGitCommit } from '../utils/git';
import { ReleaseGroupWithName } from './filter-release-groups';
export interface VersionPlanFile {
    absolutePath: string;
    relativePath: string;
    fileName: string;
    createdOnMs: number;
}
export interface RawVersionPlan extends VersionPlanFile {
    content: Record<string, string>;
    message: string;
}
export interface VersionPlan extends VersionPlanFile {
    message: string;
    /**
     * The commit that added the version plan file, will be null if the file was never committed.
     * For optimal performance, we don't apply it at the time of reading the raw contents, because
     * it hasn't yet passed further validation at that point.
     */
    commit: RawGitCommit | null;
}
export interface GroupVersionPlan extends VersionPlan {
    groupVersionBump: ReleaseType;
    /**
     * The commit that added the version plan file, will be null if the file was never committed.
     * For optimal performance, we don't apply it at the time of reading the raw contents, because.
     * it hasn't yet passed validation.
     */
    commit: RawGitCommit | null;
    /**
     * Will not be set if the group name was the trigger, otherwise will be a list of
     * all the individual project names explicitly found in the version plan file.
     */
    triggeredByProjects?: string[];
}
export interface ProjectsVersionPlan extends VersionPlan {
    projectVersionBumps: Record<string, ReleaseType>;
}
export declare function readRawVersionPlans(): Promise<RawVersionPlan[]>;
export declare function setResolvedVersionPlansOnGroups(rawVersionPlans: RawVersionPlan[], releaseGroups: ReleaseGroupWithName[], allProjectNamesInWorkspace: string[], isVerbose: boolean): Promise<ReleaseGroupWithName[]>;
export declare function getVersionPlansAbsolutePath(): string;
