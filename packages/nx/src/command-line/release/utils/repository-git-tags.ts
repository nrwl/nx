import { minimatch } from 'minimatch';
import { execCommand } from './exec-command';

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
export class RepoGitTags {
  #tagsMap = new Map<'single-branch' | 'all-branches', Array<string>>();

  /** Creates a new RepoGitTags instance with an empty cache. */
  public static create(): RepoGitTags {
    return new RepoGitTags();
  }

  /**
   * Resolves git tags with caching. Fetches from git on cache miss, returns cached tags on hit.
   * Cache key is determined by whether to check all branches or only merged branches.
   *
   * @param checkAllBranchesWhen - Strategy for checking branches (boolean, array of patterns, or undefined)
   * @returns Promise resolving to array of git tags
   */
  async resolveTags(
    checkAllBranchesWhen?: CheckAllBranchesWhen
  ): Promise<string[]> {
    const alwaysCheckAllBranches =
      await this.#alwaysCheckAllBranches(checkAllBranchesWhen);

    const cacheKey = this.#getCacheKey(alwaysCheckAllBranches);

    let tags = this.#tagsMap.get(cacheKey);
    if (!tags) {
      tags = await this.#getTags(checkAllBranchesWhen, alwaysCheckAllBranches);
    }

    this.#tagsMap.set(cacheKey, tags);

    return tags;
  }

  /** Clears the tag cache. Useful for testing or forcing a fresh fetch. */
  clean(): void {
    this.#tagsMap.clear();
  }

  /** Fetches tags from git. Falls back to all branches if no merged tags found. */
  async #getTags(
    checkAllBranchesWhen: CheckAllBranchesWhen | undefined,
    alwaysCheckAllBranches: boolean
  ): Promise<string[]> {
    const defaultGitArgs = [
      // Apply git config to take version suffixes into account when sorting, e.g. 1.0.0 is newer than 1.0.0-beta.1
      '-c',
      'versionsort.suffix=-',
      'tag',
      '--sort',
      '-v:refname',
    ];

    try {
      let tags: string[] = [];
      tags = await execCommand('git', [
        ...defaultGitArgs,
        ...(alwaysCheckAllBranches ? [] : ['--merged']),
      ]).then((r) =>
        r
          .trim()
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
      );

      if (
        // Do not run this fallback if the user explicitly set checkAllBranchesWhen to false
        checkAllBranchesWhen !== false &&
        !tags.length &&
        // There is no point in running this fallback if we already checked against all branches
        !alwaysCheckAllBranches
      ) {
        // Try again with all tags instead of just --merged ones
        tags = await execCommand('git', defaultGitArgs).then((r) =>
          r
            .trim()
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean)
        );
      }

      return tags;
    } catch (e) {
      return [];
    }
  }

  /** Resolves checkAllBranchesWhen to a boolean by checking current branch against patterns. */
  async #alwaysCheckAllBranches(
    checkAllBranchesWhen?: CheckAllBranchesWhen
  ): Promise<boolean> {
    let alwaysCheckAllBranches = false;
    /**
     * By default, we will try and resolve the latest match for the releaseTagPattern from the current branch,
     * falling back to all branches if no match is found on the current branch.
     *
     * - If checkAllBranchesWhen is true it will cause us to ALWAYS check all branches for the latest match.
     * - If checkAllBranchesWhen is explicitly set to false it will cause us to ONLY check the current branch for the latest match.
     * - If checkAllBranchesWhen is an array of strings it will cause us to check all branches WHEN the current branch is one of the strings in the array.
     */
    if (typeof checkAllBranchesWhen !== 'undefined') {
      if (typeof checkAllBranchesWhen === 'boolean') {
        alwaysCheckAllBranches = checkAllBranchesWhen;
      } else if (Array.isArray(checkAllBranchesWhen)) {
        /**
         * Get the current git branch and determine whether to check all branches based on the checkAllBranchesWhen parameter
         */
        const currentBranch = await execCommand('git', [
          'rev-parse',
          '--abbrev-ref',
          'HEAD',
        ]).then((r) => r.trim());

        // Check exact match first
        alwaysCheckAllBranches = checkAllBranchesWhen.includes(currentBranch);

        // Check if any glob pattern matches next
        if (!alwaysCheckAllBranches) {
          alwaysCheckAllBranches = checkAllBranchesWhen.some((pattern) => {
            const r = minimatch.makeRe(pattern, { dot: true });
            if (!r) {
              return false;
            }
            return r.test(currentBranch);
          });
        }
      }
    }

    return alwaysCheckAllBranches;
  }

  /** Converts boolean to readable cache key. */
  #getCacheKey(checkAllBranches: boolean): 'single-branch' | 'all-branches' {
    return checkAllBranches ? 'all-branches' : 'single-branch';
  }
}
