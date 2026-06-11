"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterReleaseGroups = filterReleaseGroups;
const find_matching_projects_1 = require("../../../utils/find-matching-projects");
const config_1 = require("./config");
function filterReleaseGroups(projectGraph, nxReleaseConfig, projectsFilter, groupsFilter) {
    let filterLog = null;
    let releaseGroups = Object.entries(nxReleaseConfig.groups).map(([name, group]) => {
        return {
            ...group,
            name,
            resolvedVersionPlans: group.versionPlans ? [] : false,
        };
    });
    const filteredProjectToReleaseGroup = new Map();
    const releaseGroupToFilteredProjects = new Map();
    for (const releaseGroup of releaseGroups) {
        for (const project of releaseGroup.projects) {
            filteredProjectToReleaseGroup.set(project, releaseGroup);
            if (!releaseGroupToFilteredProjects.has(releaseGroup)) {
                releaseGroupToFilteredProjects.set(releaseGroup, new Set());
            }
            releaseGroupToFilteredProjects.get(releaseGroup).add(project);
        }
    }
    /**
     * User is filtering to a subset of projects. We need to make sure that what they have provided can be reconciled
     * against their configuration in terms of release groups.
     */
    if (projectsFilter?.length) {
        const matchingProjectsForFilter = (0, find_matching_projects_1.findMatchingProjects)(projectsFilter, projectGraph.nodes);
        if (!matchingProjectsForFilter.length) {
            return {
                error: {
                    title: `Your --projects filter "${projectsFilter}" did not match any projects in the workspace`,
                },
                filterLog: null,
                releaseGroups: [],
                releaseGroupToFilteredProjects,
            };
        }
        // Remove any non-matching projects from filteredProjectToReleaseGroup
        for (const project of filteredProjectToReleaseGroup.keys()) {
            if (!matchingProjectsForFilter.includes(project)) {
                filteredProjectToReleaseGroup.delete(project);
            }
        }
        // Filter out any non-matching projects from the release group to filtered projects map
        for (const releaseGroup of releaseGroups) {
            releaseGroup.projects
                .filter((p) => !matchingProjectsForFilter.includes(p))
                .forEach((p) => releaseGroupToFilteredProjects.get(releaseGroup).delete(p));
        }
        /**
         * If there are release groups specified, each filtered project must match at least one release
         * group, otherwise the command + config combination is invalid.
         */
        if (releaseGroups.length) {
            const unmatchedProjects = matchingProjectsForFilter.filter((p) => !filteredProjectToReleaseGroup.has(p));
            if (unmatchedProjects.length) {
                return {
                    error: {
                        title: `The following projects which match your projects filter "${projectsFilter}" did not match any configured release groups:`,
                        bodyLines: unmatchedProjects.map((p) => `- ${p}`),
                    },
                    filterLog: null,
                    releaseGroups: [],
                    releaseGroupToFilteredProjects,
                };
            }
        }
        /**
         * If the user is filtering to a subset of projects, we need to make sure that they are all within release groups
         * with "independent" configured for their projectsRelationship. If not, the filtering is invalid, and they should instead
         * be targeting the release groups directly using the --group flag, or they should update their configuration to
         * make the projects they were trying to filter be independently releasable.
         */
        const releaseGroupsForFilteredProjects = Array.from(new Set(Array.from(filteredProjectToReleaseGroup.values())));
        const releaseGroupsThatAreNotIndependent = releaseGroupsForFilteredProjects.filter((rg) => rg.projectsRelationship !== 'independent');
        if (releaseGroupsThatAreNotIndependent.length) {
            // Special handling for IMPLICIT_DEFAULT_RELEASE_GROUP
            if (releaseGroupsThatAreNotIndependent.length === 1 &&
                releaseGroupsThatAreNotIndependent[0].name ===
                    config_1.IMPLICIT_DEFAULT_RELEASE_GROUP) {
                return {
                    error: {
                        title: `In order to release specific projects independently with --projects those projects must be configured appropriately. For example, by setting \`"projectsRelationship": "independent"\` in your nx.json config.`,
                        bodyLines: [],
                    },
                    filterLog: null,
                    releaseGroups: [],
                    releaseGroupToFilteredProjects,
                };
            }
            return {
                error: {
                    title: `Your --projects filter "${projectsFilter}" matched projects in the following release groups which do not have "independent" configured for their "projectsRelationship":`,
                    bodyLines: releaseGroupsThatAreNotIndependent.map((rg) => `- ${rg.name}`),
                },
                filterLog: null,
                releaseGroups: [],
                releaseGroupToFilteredProjects,
            };
        }
        filterLog = {
            title: `Your filter "${projectsFilter}" matched the following projects:`,
            bodyLines: matchingProjectsForFilter.map((p) => {
                const releaseGroupForProject = filteredProjectToReleaseGroup.get(p);
                if (releaseGroupForProject.name === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP) {
                    return `- ${p}`;
                }
                return `- ${p} (release group "${releaseGroupForProject.name}")`;
            }),
        };
        // Filter the releaseGroups collection appropriately
        for (const [releaseGroupWithName, matchingProjects,] of releaseGroupToFilteredProjects.entries()) {
            if (matchingProjects.size === 0) {
                releaseGroupToFilteredProjects.delete(releaseGroupWithName);
            }
        }
        releaseGroups = releaseGroups.filter((rg) => releaseGroupToFilteredProjects.get(rg)?.size > 0);
        return {
            error: null,
            filterLog,
            releaseGroups,
            releaseGroupToFilteredProjects,
        };
    }
    /**
     * The user is filtering by release group
     */
    if (groupsFilter?.length) {
        releaseGroups
            .filter((g) => !groupsFilter.includes(g.name))
            .forEach((g) => releaseGroupToFilteredProjects.delete(g));
        releaseGroups = releaseGroups.filter((g) => groupsFilter.includes(g.name));
    }
    if (!releaseGroups.length) {
        return {
            error: {
                title: groupsFilter
                    ? `Your --groups filter "${groupsFilter}" did not match any release groups in the workspace`
                    : // Getting to this point should be impossible, as we should have explicitly handled any errors/invalid config by now
                        `No projects could be matched for versioning, please report this case and include your nx.json config and command line arguments`,
            },
            filterLog: null,
            releaseGroups: [],
            releaseGroupToFilteredProjects,
        };
    }
    return {
        error: null,
        filterLog,
        releaseGroups,
        releaseGroupToFilteredProjects,
    };
}
