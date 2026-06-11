import type { ChangelogOptions } from '../command-object';
import type { NxReleaseConfig } from '../config/config';
import { RawVersionPlan } from '../config/version-plans';
import type { VersionData } from '../utils/shared';
import type { CheckAllBranchesWhen, RepoGitTags } from '../utils/repository-git-tags';
/**
 * Filters version plans to only include those that were committed between the specified SHAs
 * @param versionPlans The raw version plans to filter
 * @param fromSHA The starting commit SHA (exclusive)
 * @param toSHA The ending commit SHA (inclusive)
 * @param isVerbose Whether to output verbose logging
 * @returns The filtered version plans
 */
export declare function filterVersionPlansByCommitRange(versionPlans: RawVersionPlan[], fromSHA: string, toSHA: string, isVerbose: boolean): Promise<RawVersionPlan[]>;
/**
 * Resolves the "from SHA" for changelog purposes.
 * This determines the starting point for changelog generation and optional version plan filtering.
 */
export declare function resolveChangelogFromSHA({ fromRef, tagPattern, tagPatternValues, checkAllBranchesWhen, preid, requireSemver, strictPreid, useAutomaticFromRef, resolveRepositoryTags, }: {
    fromRef?: string;
    tagPattern: string;
    tagPatternValues: Record<string, string>;
    checkAllBranchesWhen: CheckAllBranchesWhen;
    preid?: string;
    requireSemver: boolean;
    strictPreid: boolean;
    useAutomaticFromRef: boolean;
    resolveRepositoryTags: RepoGitTags['resolveTags'];
}): Promise<string | null>;
/**
 * Helper function for workspace-level "from SHA" resolution.
 * Extracts preids and calls the generic resolver.
 */
export declare function resolveWorkspaceChangelogFromSHA({ args, nxReleaseConfig, useAutomaticFromRef, resolveRepositoryTags, }: {
    args: ChangelogOptions;
    nxReleaseConfig: NxReleaseConfig;
    useAutomaticFromRef: boolean;
    resolveRepositoryTags: RepoGitTags['resolveTags'];
}): Promise<string | null>;
export declare function extractPreidFromVersion(version: string | null | undefined): string | undefined;
export declare function extractProjectsPreidFromVersionData(versionData: VersionData | undefined): Record<string, string | undefined> | undefined;
