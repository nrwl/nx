import { ReleaseType } from 'semver';
import { GroupVersionPlan, ProjectsVersionPlan } from '../config/version-plans';
import { RawGitCommit, Reference } from '../utils/git';
export interface ChangelogChange {
    type: string;
    scope: string;
    description: string;
    affectedProjects: string[] | '*';
    body?: string;
    isBreaking?: boolean;
    githubReferences?: Reference[];
    authors?: {
        name: string;
        email: string;
    }[];
    shortHash?: string;
    revertedHashes?: string[];
}
export declare function createChangesFromGroupVersionPlans(versionPlans: GroupVersionPlan[]): ChangelogChange[];
export declare function createChangesFromProjectsVersionPlans(versionPlans: ProjectsVersionPlan[], projectName: string): ChangelogChange[];
export declare function extractVersionPlanMetadata(commit: RawGitCommit | null): {
    githubReferences: Reference[];
    authors: {
        name: string;
        email: string;
    }[] | undefined;
};
export declare function versionPlanSemverReleaseTypeToChangelogType(bump: ReleaseType): {
    type: 'fix' | 'feat';
    isBreaking: boolean;
};
