"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSpecifierFromConventionalCommits = deriveSpecifierFromConventionalCommits;
const git_1 = require("../utils/git");
const resolve_semver_specifier_1 = require("../utils/resolve-semver-specifier");
const semver_1 = require("../utils/semver");
async function deriveSpecifierFromConventionalCommits(nxReleaseConfig, projectGraph, projectLogger, releaseGroup, projectGraphNode, 
// NOTE: This TODO was carried over from the original version generator.
//
// TODO: reevaluate this prerelease logic/workflow for independent projects
// Always assume that if the current version is a prerelease, then the next version should be a prerelease.
// Users must manually graduate from a prerelease to a release by providing an explicit specifier.
isPrerelease, latestMatchingGitTag, releaseGraph, fallbackCurrentVersionResolver, preid) {
    const affectedProjects = releaseGroup.projectsRelationship === 'independent'
        ? [projectGraphNode.name]
        : releaseGroup.projects;
    // latestMatchingGitTag will be undefined if the current version was resolved from the disk fallback.
    // In this case, we want to use the first commit as the ref to be consistent with the changelog command.
    const previousVersionRef = latestMatchingGitTag
        ? latestMatchingGitTag.tag
        : fallbackCurrentVersionResolver === 'disk'
            ? await (0, git_1.getFirstGitCommit)()
            : undefined;
    if (!previousVersionRef) {
        // This should never happen since the checks above should catch if the current version couldn't be resolved
        throw new Error(`Unable to determine previous version ref for the projects ${affectedProjects.join(', ')}. This is likely a bug in Nx.`);
    }
    const projectToSpecifiers = await (0, resolve_semver_specifier_1.resolveSemverSpecifierFromConventionalCommits)(previousVersionRef, projectGraph, affectedProjects, nxReleaseConfig, releaseGraph);
    const getHighestSemverChange = (semverSpecifiersItr) => {
        const semverSpecifiers = Array.from(semverSpecifiersItr);
        return semverSpecifiers.sort((a, b) => b - a)[0];
    };
    const semverSpecifier = releaseGroup.projectsRelationship === 'independent'
        ? projectToSpecifiers.get(projectGraphNode.name)
        : getHighestSemverChange(projectToSpecifiers.values());
    let specifier = semverSpecifier === null ? null : semver_1.SemverSpecifierType[semverSpecifier];
    if (!specifier) {
        projectLogger.buffer(`🚫 No changes were detected using git history and the conventional commits standard`);
        return 'none';
    }
    // NOTE: This TODO was carried over from the original version generator.
    // TODO: reevaluate this prerelease logic/workflow for independent projects
    if (isPrerelease) {
        specifier = 'prerelease';
        projectLogger.buffer(`📄 Resolved the specifier as "${specifier}" since the current version is a prerelease`);
    }
    else {
        let extraText = '';
        if (preid && !specifier.startsWith('pre')) {
            specifier = `pre${specifier}`;
            extraText = `, combined with your given preid "${preid}"`;
        }
        projectLogger.buffer(`📄 Resolved the specifier as "${specifier}" using git history and the conventional commits standard${extraText}`);
    }
    return specifier;
}
