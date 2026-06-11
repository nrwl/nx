"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSpecifierFromVersionPlan = deriveSpecifierFromVersionPlan;
const semver_1 = require("semver");
async function deriveSpecifierFromVersionPlan(projectLogger, releaseGroup, projectGraphNode, currentVersion) {
    const projectName = projectGraphNode.name;
    let bumpType = null;
    let versionPlanPath = null;
    if (releaseGroup.projectsRelationship === 'independent') {
        const result = releaseGroup.resolvedVersionPlans.reduce((acc, plan) => {
            if (!acc.spec) {
                return {
                    spec: plan.projectVersionBumps[projectName],
                    path: plan.relativePath,
                };
            }
            if (plan.projectVersionBumps[projectName]) {
                const prevNewVersion = (0, semver_1.inc)(currentVersion, acc.spec);
                const nextNewVersion = (0, semver_1.inc)(currentVersion, plan.projectVersionBumps[projectName]);
                return (0, semver_1.gt)(nextNewVersion, prevNewVersion)
                    ? {
                        spec: plan.projectVersionBumps[projectName],
                        path: plan.relativePath,
                    }
                    : acc;
            }
            return acc;
        }, { spec: null, path: null });
        bumpType = result.spec;
        versionPlanPath = result.path;
    }
    else {
        const result = releaseGroup.resolvedVersionPlans.reduce((acc, plan) => {
            if (!acc.spec) {
                return {
                    spec: plan.groupVersionBump,
                    path: plan.relativePath,
                };
            }
            const prevNewVersion = (0, semver_1.inc)(currentVersion, acc.spec);
            const nextNewVersion = (0, semver_1.inc)(currentVersion, plan.groupVersionBump);
            return (0, semver_1.gt)(nextNewVersion, prevNewVersion)
                ? {
                    spec: plan.groupVersionBump,
                    path: plan.relativePath,
                }
                : acc;
        }, { spec: null, path: null });
        bumpType = result.spec;
        versionPlanPath = result.path;
    }
    if (!bumpType) {
        projectLogger.buffer(`🚫 No changes were detected within version plans`);
    }
    return {
        bumpType: bumpType ?? 'none',
        versionPlanPath,
    };
}
