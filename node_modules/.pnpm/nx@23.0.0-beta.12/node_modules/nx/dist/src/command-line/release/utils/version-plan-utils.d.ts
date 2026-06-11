import { GroupVersionPlan, ProjectsVersionPlan } from '../config/version-plans';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
/**
 * Validates that all projects in resolved version plans are included in the filtered projects.
 * This validation ensures that version plans don't contain projects that aren't being released.
 *
 * @param releaseGroups - The release groups to validate
 * @param releaseGroupToFilteredProjects - Map of release groups to their filtered projects
 * @returns An error object if validation fails, null otherwise
 */
export declare function validateResolvedVersionPlansAgainstFilter(releaseGroups: ReleaseGroupWithName[], releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>): {
    title: string;
    bodyLines?: string[];
} | null;
/**
 * Extracts the set of projects that a version plan affects.
 *
 * @param plan - The version plan to analyze
 * @param releaseGroup - The release group containing the version plan
 * @returns Set of project names that the version plan affects
 */
export declare function getProjectsAffectedByVersionPlan(plan: GroupVersionPlan | ProjectsVersionPlan, releaseGroup: ReleaseGroupWithName): Set<string>;
/**
 * Checks if all projects affected by a version plan are included in the filtered projects set.
 *
 * @param plan - The version plan to check
 * @param releaseGroup - The release group containing the version plan
 * @param filteredProjects - Set of projects that are being released (filtered)
 * @returns True if ALL projects in the version plan are being filtered/released
 */
export declare function areAllVersionPlanProjectsFiltered(plan: GroupVersionPlan | ProjectsVersionPlan, releaseGroup: ReleaseGroupWithName, filteredProjects: Set<string> | undefined): boolean;
/**
 * Finds projects in a version plan that are NOT included in the filtered projects set.
 *
 * @param plan - The version plan to check
 * @param releaseGroup - The release group containing the version plan
 * @param filteredProjects - Set of projects that are being released (filtered)
 * @returns Array of project names that are in the version plan but not in the filter
 */
export declare function getVersionPlanProjectsOutsideFilter(plan: GroupVersionPlan | ProjectsVersionPlan, releaseGroup: ReleaseGroupWithName, filteredProjects: Set<string> | undefined): string[];
