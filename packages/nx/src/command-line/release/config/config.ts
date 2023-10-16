/**
 * `nx release` is a powerful feature which spans many possible use cases. The possible variations
 * of configuration are therefore quite complex, particularly when you consider release groups.
 *
 * We want to provide the best possible DX for users so that they can harness the power of `nx release`
 * most effectively, therefore we need to both provide sensible defaults for common scenarios (to avoid
 * verbose nx.json files wherever possible), and proactively handle potential sources of config issues
 * in more complex use-cases.
 *
 * This file is the source of truth for all `nx release` configuration reconciliation, including sensible
 * defaults and user overrides, as well as handling common errors, up front to produce a single, consistent,
 * and easy to consume config object for all the `nx release` command implementations.
 */
import { NxJsonConfiguration } from '../../../config/nx-json';
import { output, type ProjectGraph } from '../../../devkit-exports';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { projectHasTarget } from '../../../utils/project-graph-utils';
import { resolveNxJsonConfigErrorMessage } from '../utils/resolve-nx-json-error-message';

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

type EnsureProjectsArray<T> = {
  [K in keyof T]: T[K] extends { projects: any }
    ? Omit<T[K], 'projects'> & { projects: string[] }
    : T[K];
};

export const CATCH_ALL_RELEASE_GROUP = '__default__';

/**
 * Our source of truth is a deeply required variant of the user-facing config interface, so that command
 * implementations can be sure that properties will exist and do not need to repeat the same checks over
 * and over again.
 *
 * We also normalize the projects property on release groups to always be an array of project names to make
 * it easier to work with (the user could be specifying a single string, and they can also use any valid matcher
 * pattern such as directories and globs).
 */
export type NxReleaseConfig = DeepRequired<
  NxJsonConfiguration['release'] & {
    groups: EnsureProjectsArray<NxJsonConfiguration['release']['groups']>;
  }
>;

// We explicitly handle some possible errors in order to provide the best possible DX
export interface CreateNxReleaseConfigError {
  code:
    | 'RELEASE_GROUP_MATCHES_NO_PROJECTS'
    | 'PROJECT_MATCHES_MULTIPLE_GROUPS'
    | 'PROJECTS_MISSING_TARGET';
  data: Record<string, string | string[]>;
}

// Apply default configuration to any optional user configuration and handle known errors
export async function createNxReleaseConfig(
  projectGraph: ProjectGraph,
  userConfig: NxJsonConfiguration['release'] = {},
  // Optionally ensure that all configured projects have implemented a certain target
  requiredTargetName?: 'nx-release-publish'
): Promise<{
  error: null | CreateNxReleaseConfigError;
  nxReleaseConfig: NxReleaseConfig | null;
}> {
  const DEFAULT_VERSION_GENERATOR = '@nx/js:release-version';
  const DEFAULT_VERSION_GENERATOR_OPTIONS = {};

  const allProjects = findMatchingProjects(['*'], projectGraph.nodes);
  const userSpecifiedGroups = userConfig.groups || {};

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
          nxReleaseConfig: null,
        };
      }
    }

    return {
      error: null,
      nxReleaseConfig: {
        groups: {
          [CATCH_ALL_RELEASE_GROUP]: {
            projects: allProjects,
            version: {
              generator: DEFAULT_VERSION_GENERATOR,
              generatorOptions: DEFAULT_VERSION_GENERATOR_OPTIONS,
            },
          },
        },
      },
    };
  }

  /**
   * The user has specified at least one release group.
   *
   * Resolve all the project names into their release groups, and check
   * that individual projects are not found in multiple groups.
   */
  const releaseGroups: NxReleaseConfig['groups'] = {};
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
        nxReleaseConfig: null,
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
          nxReleaseConfig: null,
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
          nxReleaseConfig: null,
        };
      }
      alreadyMatchedProjects.add(project);
    }
    releaseGroups[releaseGroupName] = {
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
    };
  }

  return {
    error: null,
    nxReleaseConfig: {
      ...userConfig,
      groups: releaseGroups,
    },
  };
}

export async function handleNxReleaseConfigError(
  error: CreateNxReleaseConfigError
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
): null | CreateNxReleaseConfigError {
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
