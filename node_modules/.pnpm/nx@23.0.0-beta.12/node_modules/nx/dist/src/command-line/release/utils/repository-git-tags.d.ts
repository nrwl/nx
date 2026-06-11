/**
 * When to check all branches for git tags instead of just merged branches.
 * - `boolean`: true = all branches, false = merged only
 * - `string[]`: Check all branches if current branch matches any pattern
 */
export type CheckAllBranchesWhen = boolean | string[];
/**
 * Caches git tags to avoid redundant git operations during release workflows.
 * Tags are cached per branch strategy ('single-branch' vs 'all-branches').
 */
export declare class RepoGitTags {
    #private;
    /** Creates a new RepoGitTags instance with an empty cache. */
    static create(): RepoGitTags;
    /**
     * Resolves git tags with caching. Fetches from git on cache miss, returns cached tags on hit.
     * Cache key is determined by whether to check all branches or only merged branches.
     *
     * @param checkAllBranchesWhen - Strategy for checking branches (boolean, array of patterns, or undefined)
     * @returns Promise resolving to array of git tags
     */
    resolveTags(checkAllBranchesWhen?: CheckAllBranchesWhen): Promise<string[]>;
    /** Clears the tag cache. Useful for testing or forcing a fresh fetch. */
    clean(): void;
}
