import { ProjectGraph } from '../../../config/project-graph';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { output } from '../../../utils/output';
import { CATCH_ALL_RELEASE_GROUP, NxReleaseConfig } from './config';

export type ReleaseGroupWithName = NxReleaseConfig['groups'][string] & {
  name: string;
};

export function filterReleaseGroups(
  projectGraph: ProjectGraph,
  nxReleaseConfig: NxReleaseConfig,
  projectsFilter?: string[],
  groupsFilter?: string[]
): {
  error: null | { title: string; bodyLines?: string[] };
  releaseGroups: ReleaseGroupWithName[];
  releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>;
} {
  let releaseGroups: ReleaseGroupWithName[] = Object.entries(
    nxReleaseConfig.groups
  ).map(([name, group]) => {
    return {
      ...group,
      name,
    };
  });

  const filteredProjectToReleaseGroup = new Map<string, ReleaseGroupWithName>();
  const releaseGroupToFilteredProjects = new Map<
    ReleaseGroupWithName,
    Set<string>
  >();

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
    const matchingProjectsForFilter = findMatchingProjects(
      projectsFilter,
      projectGraph.nodes
    );

    if (!matchingProjectsForFilter.length) {
      return {
        error: {
          title: `Your --projects filter "${projectsFilter}" did not match any projects in the workspace`,
        },
        releaseGroups: [],
        releaseGroupToFilteredProjects,
      };
    }

    // Filter out any non-matching projects from the release group to filtered projects map
    for (const releaseGroup of releaseGroups) {
      releaseGroup.projects
        .filter((p) => !matchingProjectsForFilter.includes(p))
        .forEach((p) =>
          releaseGroupToFilteredProjects.get(releaseGroup).delete(p)
        );
    }

    /**
     * If there are release groups specified, each filtered project must match at least one release
     * group, otherwise the command + config combination is invalid.
     */
    if (releaseGroups.length) {
      const unmatchedProjects = matchingProjectsForFilter.filter(
        (p) => !filteredProjectToReleaseGroup.has(p)
      );
      if (unmatchedProjects.length) {
        return {
          error: {
            title: `The following projects which match your projects filter "${projectsFilter}" did not match any configured release groups:`,
            bodyLines: unmatchedProjects.map((p) => `- ${p}`),
          },
          releaseGroups: [],
          releaseGroupToFilteredProjects,
        };
      }
    }

    output.note({
      title: `Your filter "${projectsFilter}" matched the following projects:`,
      bodyLines: matchingProjectsForFilter.map((p) => {
        const releaseGroupForProject = filteredProjectToReleaseGroup.get(p);
        if (releaseGroupForProject.name === CATCH_ALL_RELEASE_GROUP) {
          return `- ${p}`;
        }
        return `- ${p} (release group "${releaseGroupForProject.name}")`;
      }),
    });

    // Filter the releaseGroups collection appropriately
    for (const [
      releaseGroupWithName,
      matchingProjects,
    ] of releaseGroupToFilteredProjects.entries()) {
      if (matchingProjects.size === 0) {
        releaseGroupToFilteredProjects.delete(releaseGroupWithName);
      }
    }
    releaseGroups = releaseGroups.filter(
      (rg) => releaseGroupToFilteredProjects.get(rg)?.size > 0
    );

    return {
      error: null,
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
      releaseGroups: [],
      releaseGroupToFilteredProjects,
    };
  }

  return {
    error: null,
    releaseGroups,
    releaseGroupToFilteredProjects,
  };
}
