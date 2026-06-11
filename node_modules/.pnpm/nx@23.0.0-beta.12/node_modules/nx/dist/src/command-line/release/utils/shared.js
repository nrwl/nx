"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseVersion = exports.noDiffInChangelogMessage = void 0;
exports.isPrerelease = isPrerelease;
exports.commitChanges = commitChanges;
exports.createCommitMessageValues = createCommitMessageValues;
exports.shouldPreferDockerVersionForReleaseGroup = shouldPreferDockerVersionForReleaseGroup;
exports.shouldSkipVersionActions = shouldSkipVersionActions;
exports.createGitTagValues = createGitTagValues;
exports.handleDuplicateGitTags = handleDuplicateGitTags;
exports.getCommitsRelevantToProjects = getCommitsRelevantToProjects;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const semver_1 = require("semver");
const utils_1 = require("../../../tasks-runner/utils");
const output_1 = require("../../../utils/output");
const git_1 = require("./git");
const find_matching_projects_1 = require("../../../utils/find-matching-projects");
exports.noDiffInChangelogMessage = pc.yellow(`NOTE: There was no diff detected for the changelog entry. Maybe you intended to pass alternative git references via --from and --to?`);
function isPrerelease(version) {
    // prerelease returns an array of matching prerelease "components", or null if the version is not a prerelease
    try {
        return (0, semver_1.prerelease)(version) !== null;
    }
    catch {
        // If non-semver, prerelease will error. Prevent this from erroring the command
        return false;
    }
}
class ReleaseVersion {
    constructor({ version, // short form version string with no prefixes or patterns, e.g. 1.0.0
    releaseTagPattern, // full pattern to interpolate, e.g. "v{version}" or "{projectName}@{version}"
    projectName, // optional project name to interpolate into the releaseTagPattern
    releaseGroupName, // optional release group name to interpolate into the releaseTagPattern
     }) {
        this.rawVersion = version;
        this.gitTag = (0, utils_1.interpolate)(releaseTagPattern, {
            version,
            projectName: projectName
                ? (0, git_1.sanitizeProjectNameForGitTag)(projectName)
                : projectName,
            releaseGroupName,
        });
        this.isPrerelease = isPrerelease(version);
    }
}
exports.ReleaseVersion = ReleaseVersion;
async function commitChanges({ changedFiles, deletedFiles, isDryRun, isVerbose, gitCommitMessages, gitCommitArgs, }) {
    if (!changedFiles?.length && !deletedFiles?.length) {
        throw new Error('Error: No changed files to commit');
    }
    output_1.output.logSingleLine(`Committing changes with git`);
    await (0, git_1.gitAdd)({
        changedFiles,
        deletedFiles,
        dryRun: isDryRun,
        verbose: isVerbose,
    });
    // The extra logs need something breathing room
    if (isVerbose) {
        console.log('');
    }
    await (0, git_1.gitCommit)({
        messages: gitCommitMessages,
        additionalArgs: gitCommitArgs,
        dryRun: isDryRun,
        verbose: isVerbose,
    });
}
function createCommitMessageValues(releaseGroups, releaseGroupToFilteredProjects, versionData, commitMessage) {
    const commitMessageValues = [commitMessage];
    if (releaseGroups.length === 0) {
        return commitMessageValues;
    }
    // If we have exactly one release group, with a fixed relationship, then interpolate {version} as the new version for the release group
    if (releaseGroups.length === 1 &&
        releaseGroups[0].projectsRelationship === 'fixed') {
        const releaseGroup = releaseGroups[0];
        const releaseGroupProjectNames = Array.from(releaseGroupToFilteredProjects.get(releaseGroup));
        const projectVersionData = versionData[releaseGroupProjectNames[0]]; // all at the same version, so we can just pick the first one
        const releaseVersion = new ReleaseVersion({
            version: projectVersionData.newVersion,
            releaseTagPattern: releaseGroup.releaseTag.pattern,
            releaseGroupName: releaseGroup.name,
        });
        commitMessageValues[0] = (0, utils_1.interpolate)(commitMessageValues[0], {
            version: releaseVersion.rawVersion,
        }).trim();
        return commitMessageValues;
    }
    /**
     * There is another special case for interpolation: if, after all filtering, we have a single independent release group with a single project,
     * and the user has provided {projectName} within the custom message.
     * In this case we will directly interpolate both {version} and {projectName} within the commit message.
     */
    if (releaseGroups.length === 1 &&
        releaseGroups[0].projectsRelationship === 'independent' &&
        commitMessage.includes('{projectName}')) {
        const releaseGroup = releaseGroups[0];
        const releaseGroupProjectNames = Array.from(releaseGroupToFilteredProjects.get(releaseGroup));
        if (releaseGroupProjectNames.length === 1) {
            const projectVersionData = versionData[releaseGroupProjectNames[0]];
            const releaseVersion = new ReleaseVersion({
                version: projectVersionData.newVersion,
                releaseTagPattern: releaseGroup.releaseTag.pattern,
                projectName: releaseGroupProjectNames[0],
                releaseGroupName: releaseGroup.name,
            });
            commitMessageValues[0] = (0, utils_1.interpolate)(commitMessageValues[0], {
                version: releaseVersion.rawVersion,
                projectName: releaseGroupProjectNames[0],
            }).trim();
            return commitMessageValues;
        }
    }
    /**
     * At this point we have multiple release groups for a single commit, we will not interpolate an overall {version} or {projectName} because that won't be
     * appropriate (for any {version} or {projectName} value within the string, we will replace it with an empty string so that it doesn't end up in the final output).
     *
     * Instead for fixed groups we will add one bullet point the release group, and for independent groups we will add one bullet point per project.
     */
    commitMessageValues[0] = stripPlaceholders(commitMessageValues[0], [
        // for cleanest possible final result try and replace the common pattern of a v prefix in front of the version first
        'v{version}',
        '{version}',
        '{projectName}',
    ]);
    for (const releaseGroup of releaseGroups) {
        // One entry per project for independent groups
        if (releaseGroup.projectsRelationship === 'independent') {
            // Include all projects in the release group that were actually versioned,
            // not just the explicitly filtered ones. This ensures dependent projects
            // that received side-effect bumps are included in the commit message.
            const versionedProjects = releaseGroup.projects.filter((p) => versionData[p] != null && versionData[p].newVersion !== null);
            for (const project of versionedProjects) {
                const projectVersionData = versionData[project];
                if (projectVersionData.newVersion !== null) {
                    const releaseVersion = new ReleaseVersion({
                        version: projectVersionData.newVersion,
                        releaseTagPattern: releaseGroup.releaseTag.pattern,
                        projectName: project,
                        releaseGroupName: releaseGroup.name,
                    });
                    commitMessageValues.push(`- project: ${project} ${releaseVersion.rawVersion}`);
                }
            }
            continue;
        }
        // One entry for the whole group for fixed groups
        const releaseGroupProjectNames = Array.from(releaseGroupToFilteredProjects.get(releaseGroup));
        const projectVersionData = versionData[releaseGroupProjectNames[0]]; // all at the same version, so we can just pick the first one
        if (projectVersionData.newVersion !== null) {
            const releaseVersion = new ReleaseVersion({
                version: projectVersionData.newVersion,
                releaseTagPattern: releaseGroup.releaseTag.pattern,
                releaseGroupName: releaseGroup.name,
            });
            commitMessageValues.push(`- release-group: ${releaseGroup.name} ${releaseVersion.rawVersion}`);
        }
    }
    return commitMessageValues;
}
function stripPlaceholders(str, placeholders) {
    for (const placeholder of placeholders) {
        // for cleanest possible final result try and replace relevant spacing around placeholders first
        str = str
            .replace(` ${placeholder}`, '')
            .replace(`${placeholder} `, '')
            .replace(placeholder, '')
            .trim();
    }
    return str;
}
function shouldPreferDockerVersionForReleaseGroup(releaseGroup) {
    return releaseGroup.releaseTag.preferDockerVersion;
}
function shouldSkipVersionActions(dockerOptions, projectName) {
    return (dockerOptions.skipVersionActions === true ||
        (Array.isArray(dockerOptions.skipVersionActions) &&
            // skipVersionActions as string[] already normalized to matching projects in config.ts
            dockerOptions.skipVersionActions.includes(projectName)));
}
function createGitTagValues(releaseGroups, releaseGroupToFilteredProjects, versionData) {
    const tags = [];
    for (const releaseGroup of releaseGroups) {
        // For independent groups we want one tag per project, not one for the overall group
        if (releaseGroup.projectsRelationship === 'independent') {
            // Include all projects in the release group that were actually versioned,
            // not just the explicitly filtered ones. This ensures dependent projects
            // that received side-effect bumps get their own tags.
            const versionedProjects = releaseGroup.projects.filter((p) => versionData[p] != null &&
                (versionData[p].newVersion !== null ||
                    versionData[p].dockerVersion !== null));
            for (const project of versionedProjects) {
                const projectVersionData = versionData[project];
                if (projectVersionData.newVersion !== null ||
                    projectVersionData.dockerVersion !== null) {
                    const preferDockerVersion = shouldPreferDockerVersionForReleaseGroup(releaseGroup);
                    if (preferDockerVersion === 'both') {
                        // Create tags for both docker and semver versions
                        if (projectVersionData.dockerVersion) {
                            tags.push((0, utils_1.interpolate)(releaseGroup.releaseTag.pattern, {
                                version: projectVersionData.dockerVersion,
                                projectName: (0, git_1.sanitizeProjectNameForGitTag)(project),
                                releaseGroupName: releaseGroup.name,
                            }));
                        }
                        if (projectVersionData.newVersion) {
                            tags.push((0, utils_1.interpolate)(releaseGroup.releaseTag.pattern, {
                                version: projectVersionData.newVersion,
                                projectName: (0, git_1.sanitizeProjectNameForGitTag)(project),
                                releaseGroupName: releaseGroup.name,
                            }));
                        }
                    }
                    else {
                        // Use either docker version or semver version based on preference, with null fallback
                        const version = preferDockerVersion
                            ? (projectVersionData.dockerVersion ??
                                projectVersionData.newVersion)
                            : (projectVersionData.newVersion ??
                                projectVersionData.dockerVersion);
                        if (version) {
                            tags.push((0, utils_1.interpolate)(releaseGroup.releaseTag.pattern, {
                                version,
                                projectName: (0, git_1.sanitizeProjectNameForGitTag)(project),
                                releaseGroupName: releaseGroup.name,
                            }));
                        }
                    }
                }
            }
            continue;
        }
        // For fixed groups we want one tag for the overall group
        const releaseGroupProjectNames = Array.from(releaseGroupToFilteredProjects.get(releaseGroup));
        const projectVersionData = versionData[releaseGroupProjectNames[0]]; // all at the same version, so we can just pick the first one
        if (projectVersionData.newVersion !== null ||
            projectVersionData.dockerVersion !== null) {
            const preferDockerVersion = shouldPreferDockerVersionForReleaseGroup(releaseGroup);
            if (preferDockerVersion === 'both') {
                // Create tags for both docker and semver versions
                if (projectVersionData.dockerVersion) {
                    tags.push((0, utils_1.interpolate)(releaseGroup.releaseTag.pattern, {
                        version: projectVersionData.dockerVersion,
                        releaseGroupName: releaseGroup.name,
                    }));
                }
                if (projectVersionData.newVersion) {
                    tags.push((0, utils_1.interpolate)(releaseGroup.releaseTag.pattern, {
                        version: projectVersionData.newVersion,
                        releaseGroupName: releaseGroup.name,
                    }));
                }
            }
            else {
                // Use either docker version or semver version based on preference, with null fallback
                const version = preferDockerVersion
                    ? (projectVersionData.dockerVersion ?? projectVersionData.newVersion)
                    : (projectVersionData.newVersion ?? projectVersionData.dockerVersion);
                if (version) {
                    tags.push((0, utils_1.interpolate)(releaseGroup.releaseTag.pattern, {
                        version,
                        releaseGroupName: releaseGroup.name,
                    }));
                }
            }
        }
    }
    return tags;
}
function findDuplicates(arr) {
    const seen = new Set();
    const duplicates = new Set();
    for (const item of arr) {
        if (seen.has(item)) {
            duplicates.add(item);
        }
        else {
            seen.add(item);
        }
    }
    return Array.from(duplicates);
}
function handleDuplicateGitTags(gitTagValues) {
    // If any of the gitTagValues are identical we should hard error upfront to avoid an awkward git error later
    const duplicateGitTagValues = findDuplicates(gitTagValues);
    if (duplicateGitTagValues.length) {
        output_1.output.error({
            title: `Your current configuration would generate the following duplicate git tags:`,
            bodyLines: [
                ...duplicateGitTagValues.map((v) => `- ${v}`),
                '',
                `Please ensure that for "independent" release groups the {projectName} placeholder is used so that all dynamically created project tags are unique.`,
            ],
        });
        process.exit(1);
    }
}
function isAutomatedReleaseCommit(message, nxReleaseConfig) {
    // All possible commit message patterns based on config
    const commitMessagePatterns = [
        nxReleaseConfig.git.commitMessage,
        nxReleaseConfig.version.git.commitMessage,
        nxReleaseConfig.changelog.git.commitMessage,
    ];
    // Check if message matches any pattern
    for (const pattern of commitMessagePatterns) {
        if (!pattern)
            continue;
        // Split on {version}, escape each part for regex, then join with version pattern
        const parts = pattern.split('{version}');
        const escapedParts = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regexPattern = escapedParts.join('\\S+');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(message)) {
            return true;
        }
    }
    return false;
}
async function getCommitsRelevantToProjects(projectGraph, commits, projects, nxReleaseConfig, releaseGraph) {
    const projectSet = new Set(projects);
    const relevantCommits = new Map();
    for (const commit of commits) {
        // Filter out automated release commits
        if (isAutomatedReleaseCommit(commit.message, nxReleaseConfig)) {
            continue;
        }
        // Try to get the graph associated with the commit shortHash
        // if not available, calculate it and store it in the cache
        let affectedGraph = await releaseGraph.resolveAffectedFilesPerCommitInProjectGraph(commit, projectGraph);
        // Resolve commit scopes using Nx matcher
        const scopePatterns = commit.scope
            ? commit.scope.split(',').map((s) => s.trim())
            : [];
        let scopedProjects = null;
        if (scopePatterns.length > 0) {
            const matches = (0, find_matching_projects_1.findMatchingProjects)(scopePatterns, projectGraph.nodes);
            // detect ambiguity
            for (const pattern of scopePatterns) {
                const perPatternMatches = (0, find_matching_projects_1.findMatchingProjects)([pattern], projectGraph.nodes);
                if (perPatternMatches.length > 1) {
                    throw new Error(`Ambiguous scope "${pattern}" in commit "${commit.message}". ` +
                        `Matches: ${perPatternMatches.join(', ')}`);
                }
            }
            scopedProjects = new Set(matches);
        }
        for (const projectName of Object.keys(affectedGraph.nodes)) {
            if (projectSet.has(projectName)) {
                if (!relevantCommits.has(projectName)) {
                    relevantCommits.set(projectName, []);
                }
                const isProjectScopedCommit = scopedProjects === null || scopedProjects.has(projectName);
                relevantCommits
                    .get(projectName)
                    ?.push({ commit, isProjectScopedCommit });
            }
        }
    }
    return relevantCommits;
}
