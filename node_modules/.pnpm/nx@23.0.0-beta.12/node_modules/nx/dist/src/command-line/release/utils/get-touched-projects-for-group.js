"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGetTouchedProjectsForGroup = createGetTouchedProjectsForGroup;
const workspace_projects_1 = require("../../../project-graph/affected/locators/workspace-projects");
const file_utils_1 = require("../../../project-graph/file-utils");
const ignore_1 = require("../../../utils/ignore");
const output_1 = require("../../../utils/output");
const config_1 = require("../config/config");
/**
 * Create a function that returns the touched projects for a given release group. Only relevant when version plans are enabled.
 */
function createGetTouchedProjectsForGroup(nxArgs, projectGraph, changedFiles, fileData) {
    /**
     * Create a minimal subset of touched projects based on the configured ignore patterns, we only need
     * to recompute when the ignorePatternsForPlanCheck differs between release groups.
     */
    const serializedIgnorePatternsToTouchedProjects = new Map();
    return async function getTouchedProjectsForGroup(releaseGroup, 
    // We don't access releaseGroups.projects directly, because we need to take the --projects filter into account
    releaseGroupFilteredProjectNames, hasProjectsFilter) {
        // The current release group doesn't leverage version plans
        if (!releaseGroup.versionPlans) {
            return [];
        }
        // Exclude patterns from .nxignore, .gitignore and explicit version plan config
        let serializedIgnorePatterns = '[]';
        const ignore = (0, ignore_1.getIgnoreObject)();
        if (typeof releaseGroup.versionPlans !== 'boolean' &&
            Array.isArray(releaseGroup.versionPlans.ignorePatternsForPlanCheck) &&
            releaseGroup.versionPlans.ignorePatternsForPlanCheck.length) {
            output_1.output.note({
                title: `Applying configured ignore patterns to changed files${releaseGroup.name !== config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                    ? ` for release group "${releaseGroup.name}"`
                    : ''}`,
                bodyLines: [
                    ...releaseGroup.versionPlans.ignorePatternsForPlanCheck.map((pattern) => `  - ${pattern}`),
                ],
            });
            ignore.add(releaseGroup.versionPlans.ignorePatternsForPlanCheck);
            serializedIgnorePatterns = JSON.stringify(releaseGroup.versionPlans.ignorePatternsForPlanCheck);
        }
        let touchedProjects = {};
        if (serializedIgnorePatternsToTouchedProjects.has(serializedIgnorePatterns)) {
            touchedProjects = serializedIgnorePatternsToTouchedProjects.get(serializedIgnorePatterns);
        }
        else {
            // We only care about directly touched projects, not implicitly affected ones etc
            const touchedProjectsArr = await (0, workspace_projects_1.getTouchedProjects)((0, file_utils_1.calculateFileChanges)(changedFiles, nxArgs, undefined, ignore), projectGraph.nodes);
            touchedProjects = touchedProjectsArr.reduce((acc, project) => ({ ...acc, [project]: true }), {});
            serializedIgnorePatternsToTouchedProjects.set(serializedIgnorePatterns, touchedProjects);
        }
        const touchedProjectsUnderReleaseGroup = releaseGroupFilteredProjectNames.filter((project) => touchedProjects[project]);
        if (touchedProjectsUnderReleaseGroup.length) {
            output_1.output.log({
                title: `Touched projects${hasProjectsFilter ? ` (after --projects filter applied)` : ''} based on changed files${releaseGroup.name !== config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                    ? ` under release group "${releaseGroup.name}"`
                    : ''}`,
                bodyLines: [
                    ...touchedProjectsUnderReleaseGroup.map((project) => `  - ${project}`),
                    '',
                    'NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.',
                ],
            });
        }
        else {
            output_1.output.log({
                title: `No touched projects${hasProjectsFilter ? ` (after --projects filter applied)` : ''} found based on changed files${typeof releaseGroup.versionPlans !== 'boolean' &&
                    Array.isArray(releaseGroup.versionPlans.ignorePatternsForPlanCheck) &&
                    releaseGroup.versionPlans.ignorePatternsForPlanCheck.length
                    ? ' combined with configured ignore patterns'
                    : ''}${releaseGroup.name !== config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                    ? ` under release group "${releaseGroup.name}"`
                    : ''}`,
            });
        }
        return touchedProjectsUnderReleaseGroup;
    };
}
