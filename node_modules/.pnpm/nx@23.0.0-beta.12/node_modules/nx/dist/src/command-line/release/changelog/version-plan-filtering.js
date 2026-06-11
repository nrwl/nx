"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterVersionPlansByCommitRange = filterVersionPlansByCommitRange;
exports.resolveChangelogFromSHA = resolveChangelogFromSHA;
exports.resolveWorkspaceChangelogFromSHA = resolveWorkspaceChangelogFromSHA;
exports.extractPreidFromVersion = extractPreidFromVersion;
exports.extractProjectsPreidFromVersionData = extractProjectsPreidFromVersionData;
const path_1 = require("path");
const semver_1 = require("semver");
const workspace_root_1 = require("../../../utils/workspace-root");
const exec_command_1 = require("../utils/exec-command");
const git_1 = require("../utils/git");
/**
 * Filters version plans to only include those that were committed between the specified SHAs
 * @param versionPlans The raw version plans to filter
 * @param fromSHA The starting commit SHA (exclusive)
 * @param toSHA The ending commit SHA (inclusive)
 * @param isVerbose Whether to output verbose logging
 * @returns The filtered version plans
 */
async function filterVersionPlansByCommitRange(versionPlans, fromSHA, toSHA, isVerbose) {
    if (versionPlans.length === 0) {
        return [];
    }
    // Get all files added within the commit range with a single git command
    const filesAddedInRange = await getFilesAddedInCommitRange(fromSHA, toSHA, isVerbose);
    // Filter version plans based on whether they were added in the range
    const filteredPlans = versionPlans.filter((plan) => {
        const isInRange = filesAddedInRange.has(plan.absolutePath);
        if (!isInRange && isVerbose) {
            console.log(`Filtering out version plan '${plan.fileName}' as it was not committed in the range ${fromSHA}..${toSHA}`);
        }
        else if (isInRange && isVerbose) {
            console.log(`Version plan '${plan.fileName}' was added in commit range`);
        }
        return isInRange;
    });
    if (isVerbose) {
        console.log(`Filtered ${versionPlans.length} version plans down to ${filteredPlans.length} based on commit range`);
    }
    return filteredPlans;
}
/**
 * Gets all version plan files that were added within the commit range
 * @param fromSHA The starting commit SHA (exclusive)
 * @param toSHA The ending commit SHA (inclusive)
 * @param isVerbose Whether to output verbose logging
 * @returns Set of absolute file paths that were added in the range
 */
async function getFilesAddedInCommitRange(fromSHA, toSHA, isVerbose) {
    try {
        // Use git log to get version plan files added within the commit range
        // --name-only shows just the file paths
        // --diff-filter=A shows only added files
        // -- .nx/version-plans/ limits to only files in that directory
        // Note: Git pathspecs always use forward slashes, even on Windows
        const stdout = await (0, exec_command_1.execCommand)('git', [
            'log',
            `${fromSHA}..${toSHA}`,
            '--diff-filter=A',
            '--name-only',
            '--pretty=format:',
            '--',
            '.nx/version-plans/',
        ]);
        // Parse the output to get unique file paths
        const files = stdout
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((relativePath) => {
            // Convert relative paths to absolute paths
            return (0, path_1.join)(workspace_root_1.workspaceRoot, relativePath);
        });
        const uniqueFiles = new Set(files);
        if (isVerbose && uniqueFiles.size > 0) {
            console.log(`Found ${uniqueFiles.size} version plan files added in commit range`);
        }
        return uniqueFiles;
    }
    catch (err) {
        if (isVerbose) {
            console.error(`Error getting files in commit range: ${err.message || err}`);
        }
        // If there's an error, return empty set (no filtering)
        return new Set();
    }
}
/**
 * Resolves the "from SHA" for changelog purposes.
 * This determines the starting point for changelog generation and optional version plan filtering.
 */
async function resolveChangelogFromSHA({ fromRef, tagPattern, tagPatternValues, checkAllBranchesWhen, preid, requireSemver, strictPreid, useAutomaticFromRef, resolveRepositoryTags, }) {
    // If user provided a from ref, resolve it to a SHA
    if (fromRef) {
        return await (0, git_1.getCommitHash)(fromRef);
    }
    // Otherwise, try to resolve it from the latest tag
    const latestTag = await (0, git_1.getLatestGitTagForPattern)(tagPattern, tagPatternValues, resolveRepositoryTags, {
        checkAllBranchesWhen,
        preid,
        requireSemver,
        strictPreid,
    });
    if (latestTag?.tag) {
        return await (0, git_1.getCommitHash)(latestTag.tag);
    }
    // Finally, if automatic from ref is enabled, use the first commit as a fallback
    if (useAutomaticFromRef) {
        return await (0, git_1.getFirstGitCommit)();
    }
    return null;
}
/**
 * Helper function for workspace-level "from SHA" resolution.
 * Extracts preids and calls the generic resolver.
 */
async function resolveWorkspaceChangelogFromSHA({ args, nxReleaseConfig, useAutomaticFromRef, resolveRepositoryTags, }) {
    const workspacePreid = extractPreidFromVersion(args.version);
    const projectsPreid = extractProjectsPreidFromVersionData(args.versionData);
    return resolveChangelogFromSHA({
        fromRef: args.from,
        tagPattern: nxReleaseConfig.releaseTag.pattern,
        tagPatternValues: {},
        checkAllBranchesWhen: nxReleaseConfig.releaseTag.checkAllBranchesWhen,
        preid: workspacePreid ?? projectsPreid?.[Object.keys(projectsPreid)[0]],
        requireSemver: nxReleaseConfig.releaseTag.requireSemver,
        strictPreid: nxReleaseConfig.releaseTag.strictPreid,
        useAutomaticFromRef,
        resolveRepositoryTags,
    });
}
function extractPreidFromVersion(version) {
    try {
        const preid = (0, semver_1.prerelease)(version)?.[0];
        return typeof preid === 'string' ? preid : undefined;
    }
    catch {
        return undefined;
    }
}
function extractProjectsPreidFromVersionData(versionData) {
    if (!versionData) {
        return undefined;
    }
    const result = {};
    for (const [project, data] of Object.entries(versionData)) {
        if (data?.newVersion) {
            result[project] = extractPreidFromVersion(data.newVersion);
        }
    }
    return result;
}
