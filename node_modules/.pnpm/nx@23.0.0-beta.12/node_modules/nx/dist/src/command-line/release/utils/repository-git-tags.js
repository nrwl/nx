"use strict";
var _RepoGitTags_instances, _RepoGitTags_tagsMap, _RepoGitTags_getTags, _RepoGitTags_alwaysCheckAllBranches, _RepoGitTags_getCacheKey;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoGitTags = void 0;
const tslib_1 = require("tslib");
const minimatch_1 = require("minimatch");
const exec_command_1 = require("./exec-command");
/**
 * Caches git tags to avoid redundant git operations during release workflows.
 * Tags are cached per branch strategy ('single-branch' vs 'all-branches').
 */
class RepoGitTags {
    constructor() {
        _RepoGitTags_instances.add(this);
        _RepoGitTags_tagsMap.set(this, new Map());
    }
    /** Creates a new RepoGitTags instance with an empty cache. */
    static create() {
        return new RepoGitTags();
    }
    /**
     * Resolves git tags with caching. Fetches from git on cache miss, returns cached tags on hit.
     * Cache key is determined by whether to check all branches or only merged branches.
     *
     * @param checkAllBranchesWhen - Strategy for checking branches (boolean, array of patterns, or undefined)
     * @returns Promise resolving to array of git tags
     */
    async resolveTags(checkAllBranchesWhen) {
        const alwaysCheckAllBranches = await tslib_1.__classPrivateFieldGet(this, _RepoGitTags_instances, "m", _RepoGitTags_alwaysCheckAllBranches).call(this, checkAllBranchesWhen);
        const cacheKey = tslib_1.__classPrivateFieldGet(this, _RepoGitTags_instances, "m", _RepoGitTags_getCacheKey).call(this, alwaysCheckAllBranches);
        let tags = tslib_1.__classPrivateFieldGet(this, _RepoGitTags_tagsMap, "f").get(cacheKey);
        if (!tags) {
            tags = await tslib_1.__classPrivateFieldGet(this, _RepoGitTags_instances, "m", _RepoGitTags_getTags).call(this, checkAllBranchesWhen, alwaysCheckAllBranches);
        }
        tslib_1.__classPrivateFieldGet(this, _RepoGitTags_tagsMap, "f").set(cacheKey, tags);
        return tags;
    }
    /** Clears the tag cache. Useful for testing or forcing a fresh fetch. */
    clean() {
        tslib_1.__classPrivateFieldGet(this, _RepoGitTags_tagsMap, "f").clear();
    }
}
exports.RepoGitTags = RepoGitTags;
_RepoGitTags_tagsMap = new WeakMap(), _RepoGitTags_instances = new WeakSet(), _RepoGitTags_getTags = 
/** Fetches tags from git. Falls back to all branches if no merged tags found. */
async function _RepoGitTags_getTags(checkAllBranchesWhen, alwaysCheckAllBranches) {
    const defaultGitArgs = [
        // Apply git config to take version suffixes into account when sorting, e.g. 1.0.0 is newer than 1.0.0-beta.1
        '-c',
        'versionsort.suffix=-',
        'tag',
        '--sort',
        '-v:refname',
    ];
    try {
        let tags = [];
        tags = await (0, exec_command_1.execCommand)('git', [
            ...defaultGitArgs,
            ...(alwaysCheckAllBranches ? [] : ['--merged']),
        ]).then((r) => r
            .trim()
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean));
        if (
        // Do not run this fallback if the user explicitly set checkAllBranchesWhen to false
        checkAllBranchesWhen !== false &&
            !tags.length &&
            // There is no point in running this fallback if we already checked against all branches
            !alwaysCheckAllBranches) {
            // Try again with all tags instead of just --merged ones
            tags = await (0, exec_command_1.execCommand)('git', defaultGitArgs).then((r) => r
                .trim()
                .split('\n')
                .map((t) => t.trim())
                .filter(Boolean));
        }
        return tags;
    }
    catch (e) {
        return [];
    }
}, _RepoGitTags_alwaysCheckAllBranches = 
/** Resolves checkAllBranchesWhen to a boolean by checking current branch against patterns. */
async function _RepoGitTags_alwaysCheckAllBranches(checkAllBranchesWhen) {
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
        }
        else if (Array.isArray(checkAllBranchesWhen)) {
            /**
             * Get the current git branch and determine whether to check all branches based on the checkAllBranchesWhen parameter
             */
            const currentBranch = await (0, exec_command_1.execCommand)('git', [
                'rev-parse',
                '--abbrev-ref',
                'HEAD',
            ]).then((r) => r.trim());
            // Check exact match first
            alwaysCheckAllBranches = checkAllBranchesWhen.includes(currentBranch);
            // Check if any glob pattern matches next
            if (!alwaysCheckAllBranches) {
                alwaysCheckAllBranches = checkAllBranchesWhen.some((pattern) => {
                    const r = minimatch_1.minimatch.makeRe(pattern, { dot: true });
                    if (!r) {
                        return false;
                    }
                    return r.test(currentBranch);
                });
            }
        }
    }
    return alwaysCheckAllBranches;
}, _RepoGitTags_getCacheKey = function _RepoGitTags_getCacheKey(checkAllBranches) {
    return checkAllBranches ? 'all-branches' : 'single-branch';
};
