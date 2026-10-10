import { GroupVersionPlan, ProjectsVersionPlan } from '../config/version-plans';
import { ReleaseGroupWithName } from '../config/filter-release-groups';

/**
 * Validates that no version plan mixes projects being released with projects outside the release filter,
 * as such a plan could neither be fully applied nor safely deleted.
 *
 * @param releaseGroups - All configured release groups, so that plans spanning groups outside the filter are caught
 * @param releaseGroupToFilteredProjects - Map of release groups to their filtered projects
 * @returns An error object if validation fails, null otherwise
 */
export function validateResolvedVersionPlansAgainstFilter(
  releaseGroups: ReleaseGroupWithName[],
  releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>
): { title: string; bodyLines?: string[] } | null {
  const projectsByPlanFile = new Map<
    string,
    { filtered: Set<string>; outsideFilter: Set<string> }
  >();

  for (const releaseGroup of releaseGroups) {
    if (!releaseGroup.resolvedVersionPlans) {
      continue;
    }
    const filteredProjects = releaseGroupToFilteredProjects.get(releaseGroup);

    for (const plan of releaseGroup.resolvedVersionPlans) {
      let projects = projectsByPlanFile.get(plan.fileName);
      if (!projects) {
        projects = { filtered: new Set(), outsideFilter: new Set() };
        projectsByPlanFile.set(plan.fileName, projects);
      }
      for (const project of getProjectsAffectedByVersionPlan(
        plan,
        releaseGroup
      )) {
        if (filteredProjects?.has(project)) {
          projects.filtered.add(project);
        } else {
          projects.outsideFilter.add(project);
        }
      }
    }
  }

  for (const [fileName, { filtered, outsideFilter }] of projectsByPlanFile) {
    if (filtered.size > 0 && outsideFilter.size > 0) {
      return {
        title: `Version plan contains projects not included in the release filter`,
        bodyLines: [
          `The following projects in version plan '${fileName}' are not being released:`,
          ...Array.from(outsideFilter).map((p) => `  - ${p}`),
          '',
          `Either include all projects from the version plan in your release command,`,
          `or create separate version plans for different sets of projects.`,
        ],
      };
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
export function getProjectsAffectedByVersionPlan(
  plan: GroupVersionPlan | ProjectsVersionPlan,
  releaseGroup: ReleaseGroupWithName
): Set<string> {
  const planProjects = new Set<string>();

  // Collect all projects mentioned in this version plan
  if ('groupVersionBump' in plan && plan.groupVersionBump) {
    // Version plan applies to the entire group
    releaseGroup.projects.forEach((p) => planProjects.add(p));
  } else if ('projectVersionBumps' in plan && plan.projectVersionBumps) {
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
export function areAllVersionPlanProjectsFiltered(
  plan: GroupVersionPlan | ProjectsVersionPlan,
  releaseGroup: ReleaseGroupWithName,
  filteredProjects: Set<string> | undefined
): boolean {
  if (!filteredProjects) {
    return false;
  }

  const planProjects = getProjectsAffectedByVersionPlan(plan, releaseGroup);

  // Only return true if the plan affects at least one project and ALL of them are filtered
  return (
    planProjects.size > 0 &&
    Array.from(planProjects).every((project) => filteredProjects.has(project))
  );
}
