import type { NxJsonConfiguration } from '../../../config/nx-json';
import { output, type ProjectGraph } from '../../../devkit-exports';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { projectHasTarget } from '../../../utils/project-graph-utils';
import { resolveNxJsonConfigErrorMessage } from '../utils/resolve-nx-json-error-message';

export interface ReleaseGroup {
  name: string;
  projects: string[];
  version: {
    generator: string;
    generatorOptions: Record<string, unknown>;
  };
}

// We explicitly handle some expected errors in order to provide the best possible DX
interface CreateReleaseGroupsError {
  code:
    | 'RELEASE_GROUP_MATCHES_NO_PROJECTS'
    | 'PROJECT_MATCHES_MULTIPLE_GROUPS'
    | 'PROJECTS_MISSING_TARGET';
  data: Record<string, string | string[]>;
}

export const CATCH_ALL_RELEASE_GROUP = '__default__';

/**
 * Create a set of release groups based on the relevant user specified config ready
 * to be consumed by the release commands.
 */
export async function createReleaseGroups(
  projectGraph: ProjectGraph,
  userSpecifiedGroups: NxJsonConfiguration['release']['groups'] = {},
  requiredTargetName?: 'release-publish'
): Promise<{
  error: null | CreateReleaseGroupsError;
  releaseGroups: ReleaseGroup[];
}> {
  const DEFAULT_VERSION_GENERATOR = '@nx/js:release-version';
  const DEFAULT_VERSION_GENERATOR_OPTIONS = {};

  const allProjects = findMatchingProjects(['*'], projectGraph.nodes);

  /**
   * No user specified release groups, so we treat all projects as being in one release group
   * together in which all projects are released in lock step.
   */
  if (Object.keys(userSpecifiedGroups).length === 0) {
    // Ensure all projects have the relevant target available, if applicable
    if (requiredTargetName) {
      const error = ensureProjectsHaveTarget(
        allProjects,
        projectGraph,
        requiredTargetName
      );
      if (error) {
        return {
          error,
          releaseGroups: [],
        };
      }
    }

    return {
      error: null,
      releaseGroups: [
        {
          name: CATCH_ALL_RELEASE_GROUP,
          projects: allProjects,
          version: {
            generator: DEFAULT_VERSION_GENERATOR,
            generatorOptions: DEFAULT_VERSION_GENERATOR_OPTIONS,
          },
        },
      ],
    };
  }

  /**
   * The user has specified at least one release group.
   *
   * Resolve all the project names into their release groups, and check
   * that individual projects are not found in multiple groups.
   */
  const releaseGroups: ReleaseGroup[] = [];
  const alreadyMatchedProjects = new Set<string>();

  for (const [releaseGroupName, userSpecifiedGroup] of Object.entries(
    userSpecifiedGroups
  )) {
    // Ensure that the user config for the release group can resolve at least one project
    const matchingProjects = findMatchingProjects(
      Array.isArray(userSpecifiedGroup.projects)
        ? userSpecifiedGroup.projects
        : [userSpecifiedGroup.projects],
      projectGraph.nodes
    );
    if (!matchingProjects.length) {
      return {
        error: {
          code: 'RELEASE_GROUP_MATCHES_NO_PROJECTS',
          data: {
            releaseGroupName: releaseGroupName,
          },
        },
        releaseGroups: [],
      };
    }

    // Ensure all matching projects have the relevant target available, if applicable
    if (requiredTargetName) {
      const error = ensureProjectsHaveTarget(
        matchingProjects,
        projectGraph,
        requiredTargetName
      );
      if (error) {
        return {
          error,
          releaseGroups: [],
        };
      }
    }

    for (const project of matchingProjects) {
      if (alreadyMatchedProjects.has(project)) {
        return {
          error: {
            code: 'PROJECT_MATCHES_MULTIPLE_GROUPS',
            data: {
              project,
            },
          },
          releaseGroups: [],
        };
      }
      alreadyMatchedProjects.add(project);
    }
    releaseGroups.push({
      name: releaseGroupName,
      projects: matchingProjects,
      version: userSpecifiedGroup.version
        ? {
            generator:
              userSpecifiedGroup.version.generator || DEFAULT_VERSION_GENERATOR,
            generatorOptions:
              userSpecifiedGroup.version.generatorOptions ||
              DEFAULT_VERSION_GENERATOR_OPTIONS,
          }
        : {
            generator: DEFAULT_VERSION_GENERATOR,
            generatorOptions: DEFAULT_VERSION_GENERATOR_OPTIONS,
          },
    });
  }

  return {
    error: null,
    releaseGroups,
  };
}

export async function handleCreateReleaseGroupsError(
  error: CreateReleaseGroupsError
) {
  switch (error.code) {
    case 'RELEASE_GROUP_MATCHES_NO_PROJECTS':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
          'groups',
        ]);
        output.error({
          title: `Release group "${error.data.releaseGroupName}" matches no projects. Please ensure all release groups match at least one project:`,
          bodyLines: [nxJsonMessage],
        });
      }
      break;
    case 'PROJECT_MATCHES_MULTIPLE_GROUPS':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
          'groups',
        ]);
        output.error({
          title: `Project "${error.data.project}" matches multiple release groups. Please ensure all projects are part of only one release group:`,
          bodyLines: [nxJsonMessage],
        });
      }
      break;
    case 'PROJECTS_MISSING_TARGET':
      {
        output.error({
          title: `Based on your config, the following projects were matched for release but do not have a "${error.data.targetName}" target specified. Please ensure you have an appropriate plugin such as @nx/js installed, or have configured the target manually, or exclude the projects using release groups config in nx.json:`,
          bodyLines: Array.from(error.data.projects).map((name) => `- ${name}`),
        });
      }
      break;
    default:
      throw new Error(`Unhandled error code: ${error.code}`);
  }

  process.exit(1);
}

function ensureProjectsHaveTarget(
  projects: string[],
  projectGraph: ProjectGraph,
  requiredTargetName: string
): null | CreateReleaseGroupsError {
  const missingTargetProjects = projects.filter(
    (project) =>
      !projectHasTarget(projectGraph.nodes[project], requiredTargetName)
  );
  if (missingTargetProjects.length) {
    return {
      code: 'PROJECTS_MISSING_TARGET',
      data: {
        targetName: requiredTargetName,
        projects: missingTargetProjects,
      },
    };
  }
  return null;
}
