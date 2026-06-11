"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChangesFromGroupVersionPlans = createChangesFromGroupVersionPlans;
exports.createChangesFromProjectsVersionPlans = createChangesFromProjectsVersionPlans;
exports.extractVersionPlanMetadata = extractVersionPlanMetadata;
exports.versionPlanSemverReleaseTypeToChangelogType = versionPlanSemverReleaseTypeToChangelogType;
const git_1 = require("../utils/git");
function createChangesFromGroupVersionPlans(versionPlans) {
    return versionPlans
        .flatMap((vp) => {
        const releaseType = versionPlanSemverReleaseTypeToChangelogType(vp.groupVersionBump);
        const { githubReferences, authors } = extractVersionPlanMetadata(vp.commit);
        const changes = !vp.triggeredByProjects
            ? [
                {
                    type: releaseType.type,
                    scope: '',
                    description: vp.message,
                    body: '',
                    isBreaking: releaseType.isBreaking,
                    githubReferences,
                    authors,
                    affectedProjects: '*',
                },
            ]
            : vp.triggeredByProjects.map((project) => {
                return {
                    type: releaseType.type,
                    scope: project,
                    description: vp.message,
                    body: '',
                    isBreaking: releaseType.isBreaking,
                    githubReferences,
                    authors,
                    affectedProjects: [project],
                };
            });
        return changes;
    })
        .filter(Boolean);
}
function createChangesFromProjectsVersionPlans(versionPlans, projectName) {
    return versionPlans
        .map((vp) => {
        const bumpForProject = vp.projectVersionBumps[projectName];
        if (!bumpForProject) {
            return null;
        }
        const releaseType = versionPlanSemverReleaseTypeToChangelogType(bumpForProject);
        const { githubReferences, authors } = extractVersionPlanMetadata(vp.commit);
        return {
            type: releaseType.type,
            scope: projectName,
            description: vp.message,
            body: '',
            isBreaking: releaseType.isBreaking,
            affectedProjects: Object.keys(vp.projectVersionBumps),
            githubReferences,
            authors,
        };
    })
        .filter(Boolean);
}
function extractVersionPlanMetadata(commit) {
    if (!commit) {
        return { githubReferences: [], authors: undefined };
    }
    const parsedCommit = (0, git_1.parseVersionPlanCommit)(commit);
    if (!parsedCommit) {
        return { githubReferences: [], authors: undefined };
    }
    return {
        githubReferences: parsedCommit.references,
        authors: parsedCommit.authors,
    };
}
function versionPlanSemverReleaseTypeToChangelogType(bump) {
    switch (bump) {
        case 'premajor':
        case 'major':
            return { type: 'feat', isBreaking: true };
        case 'preminor':
        case 'minor':
            return { type: 'feat', isBreaking: false };
        case 'prerelease':
        case 'prepatch':
        case 'patch':
            return { type: 'fix', isBreaking: false };
        default:
            throw new Error(`Invalid semver bump type: ${bump}`);
    }
}
