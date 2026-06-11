"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateResolvedVersionPlansAgainstFilter = validateResolvedVersionPlansAgainstFilter;
exports.getProjectsAffectedByVersionPlan = getProjectsAffectedByVersionPlan;
exports.areAllVersionPlanProjectsFiltered = areAllVersionPlanProjectsFiltered;
exports.getVersionPlanProjectsOutsideFilter = getVersionPlanProjectsOutsideFilter;
/**
 * Validates that all projects in resolved version plans are included in the filtered projects.
 * This validation ensures that version plans don't contain projects that aren't being released.
 *
 * @param releaseGroups - The release groups to validate
 * @param releaseGroupToFilteredProjects - Map of release groups to their filtered projects
 * @returns An error object if validation fails, null otherwise
 */
function validateResolvedVersionPlansAgainstFilter(releaseGroups, releaseGroupToFilteredProjects) {
    for (const releaseGroup of releaseGroups) {
        if (releaseGroup.resolvedVersionPlans &&
            releaseGroup.resolvedVersionPlans.length > 0) {
            const filteredProjects = releaseGroupToFilteredProjects.get(releaseGroup);
            for (const plan of releaseGroup.resolvedVersionPlans) {
                // check if version plan applies to filtered projects
                if (!checkVersionPlanContainsFilteredProjects(plan, releaseGroup, filteredProjects)) {
                    continue;
                }
                // Check if version plan contains projects outside the filter
                const projectsOutsideFilter = getVersionPlanProjectsOutsideFilter(plan, releaseGroup, filteredProjects);
                if (projectsOutsideFilter.length > 0) {
                    // Error if version plan contains projects not in the filter
                    return {
                        title: `Version plan contains projects not included in the release filter`,
                        bodyLines: [
                            `The following projects in the version plan are not being released:`,
                            ...projectsOutsideFilter.map((p) => `  - ${p}`),
                            '',
                            `Either include all projects from the version plan in your release command,`,
                            `or create separate version plans for different sets of projects.`,
                        ],
                    };
                }
            }
        }
    }
    return null;
}
/**
 * Extracts the set of projects that a version plan affects.
 *
 * @param plan - The version plan to analyze
 * @param releaseGroup - The release group containing the version plan
 * @returns Set of project names that the version plan affects
 */
function getProjectsAffectedByVersionPlan(plan, releaseGroup) {
    const planProjects = new Set();
    // Collect all projects mentioned in this version plan
    if ('groupVersionBump' in plan && plan.groupVersionBump) {
        // Version plan applies to the entire group
        releaseGroup.projects.forEach((p) => planProjects.add(p));
    }
    else if ('projectVersionBumps' in plan && plan.projectVersionBumps) {
        // Version plan has specific project bumps
        Object.keys(plan.projectVersionBumps).forEach((p) => planProjects.add(p));
    }
    return planProjects;
}
/**
 * Checks if all projects affected by a version plan are included in the filtered projects set.
 *
 * @param plan - The version plan to check
 * @param releaseGroup - The release group containing the version plan
 * @param filteredProjects - Set of projects that are being released (filtered)
 * @returns True if ALL projects in the version plan are being filtered/released
 */
function areAllVersionPlanProjectsFiltered(plan, releaseGroup, filteredProjects) {
    if (!filteredProjects) {
        return false;
    }
    const planProjects = getProjectsAffectedByVersionPlan(plan, releaseGroup);
    // Only return true if the plan affects at least one project and ALL of them are filtered
    return (planProjects.size > 0 &&
        Array.from(planProjects).every((project) => filteredProjects.has(project)));
}
/**
 * Finds projects in a version plan that are NOT included in the filtered projects set.
 *
 * @param plan - The version plan to check
 * @param releaseGroup - The release group containing the version plan
 * @param filteredProjects - Set of projects that are being released (filtered)
 * @returns Array of project names that are in the version plan but not in the filter
 */
function getVersionPlanProjectsOutsideFilter(plan, releaseGroup, filteredProjects) {
    if (!filteredProjects) {
        return [];
    }
    const planProjects = getProjectsAffectedByVersionPlan(plan, releaseGroup);
    return Array.from(planProjects).filter((project) => !filteredProjects.has(project));
}
/**
 * Checks whether the version plan contains any of the filtered projects.
 *
 * @param plan - The version plan to check.
 * @param releaseGroup - The release group associated with the version plan.
 * @param filteredProjects - Set of projects that are being released (filtered).
 * @returns Returns true if the version plan contains any of the filtered projects, or if no filtered projects are provided.
 */
function checkVersionPlanContainsFilteredProjects(plan, releaseGroup, filteredProjects) {
    if (!filteredProjects) {
        return true;
    }
    const planProjects = getProjectsAffectedByVersionPlan(plan, releaseGroup);
    return Array.from(filteredProjects).some((project) => planProjects.has(project));
}
