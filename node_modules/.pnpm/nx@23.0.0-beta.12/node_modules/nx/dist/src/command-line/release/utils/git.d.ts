import type { CheckAllBranchesWhen, RepoGitTags } from './repository-git-tags';
export interface GitCommitAuthor {
    name: string;
    email: string;
}
export interface RawGitCommit {
    message: string;
    body: string;
    shortHash: string;
    author: GitCommitAuthor;
}
export interface Reference {
    type: 'hash' | 'issue' | 'pull-request';
    value: string;
}
export interface GitTagAndVersion {
    tag: string;
    extractedVersion: string;
}
export interface GitCommit extends RawGitCommit {
    description: string;
    type: string;
    scope: string;
    references: Reference[];
    authors: GitCommitAuthor[];
    isBreaking: boolean;
    affectedFiles: string[];
    revertedHashes: string[];
}
export interface GetLatestGitTagForPatternOptions {
    checkAllBranchesWhen?: CheckAllBranchesWhen;
    preid?: string;
    requireSemver: boolean;
    strictPreid: boolean;
}
/**
 * Sanitizes a project name to be valid for use in git tag names.
 *
 * Git tag names have specific restrictions per git-check-ref-format.
 * This function handles:
 * - Colons (:) - replaced with slashes (/) for Gradle-style module paths
 * - Other invalid characters - replaced with hyphens (-)
 * - Consecutive slashes - collapsed to single slash
 * - Leading/trailing slashes - removed
 * - Consecutive dots - replaced with single dot
 *
 * @param name - The project name to sanitize
 * @returns The sanitized name suitable for git tags
 */
export declare function sanitizeProjectNameForGitTag(name: string): string;
/**
 * Extract the tag and version from a tag string
 *
 * @param tag - The tag string to extract the tag and version from
 * @param tagRegexp - The regex to use to extract the tag and version from the tag string
 *
 * @returns The tag and version
 */
export declare function extractTagAndVersion(tag: string, tagRegexp: string, options: GetLatestGitTagForPatternOptions): GitTagAndVersion;
/**
 * Get the latest git tag for the configured release tag pattern.
 *
 * This function will:
 * - Get all tags from the git repo, sorted by version
 * - Filter the tags into a list with SEMVER-compliant tags, matching the release tag pattern
 * - If a preid is provided, prioritise tags for that preid, then semver tags without a preid
 * - If no preid is provided, search only for stable semver tags (i.e. no pre-release or build metadata)
 *
 * @param releaseTagPattern - The pattern to filter the tags list by
 * @param additionalInterpolationData - Additional data used when interpolating the release tag pattern
 * @param options - The options to use when getting the latest git tag for the pattern
 *
 * @returns The tag and version
 */
export declare function getLatestGitTagForPattern(releaseTagPattern: string, additionalInterpolationData: {}, resolveTags: RepoGitTags['resolveTags'], options: GetLatestGitTagForPatternOptions): Promise<GitTagAndVersion | null>;
export declare function getGitDiff(from: string | undefined, to?: string): Promise<RawGitCommit[]>;
export declare function gitAdd({ changedFiles, deletedFiles, dryRun, verbose, logFn, cwd, }: {
    changedFiles?: string[];
    deletedFiles?: string[];
    dryRun?: boolean;
    verbose?: boolean;
    cwd?: string;
    logFn?: (...messages: string[]) => void;
}): Promise<string>;
export declare function gitCommit({ messages, additionalArgs, dryRun, verbose, logFn, }: {
    messages: string[];
    additionalArgs?: string | string[];
    dryRun?: boolean;
    verbose?: boolean;
    logFn?: (message: string) => void;
}): Promise<string>;
export declare function gitTag({ tag, message, additionalArgs, dryRun, verbose, logFn, }: {
    tag: string;
    message?: string;
    additionalArgs?: string | string[];
    dryRun?: boolean;
    verbose?: boolean;
    logFn?: (message: string) => void;
}): Promise<string>;
export declare function gitPush({ gitRemote, dryRun, verbose, additionalArgs, }: {
    gitRemote?: string;
    dryRun?: boolean;
    verbose?: boolean;
    additionalArgs?: string | string[];
}): Promise<void>;
export declare function parseCommits(commits: RawGitCommit[]): GitCommit[];
export declare function parseConventionalCommitsMessage(message: string): {
    type: string;
    scope: string;
    description: string;
    breaking: boolean;
} | null;
export declare function extractReferencesFromCommit(commit: RawGitCommit): Reference[];
export declare function parseVersionPlanCommit(commit: RawGitCommit): {
    references: Reference[];
    authors: GitCommitAuthor[];
};
export declare function parseGitCommit(commit: RawGitCommit): GitCommit | null;
export declare function getCommitHash(ref: string): Promise<string>;
export declare function getFirstGitCommit(): Promise<string>;
