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
import { join, relative } from 'node:path';
import { URL } from 'node:url';
import {
  LegacyNxReleaseVersionConfiguration,
  NxJsonConfiguration,
  NxReleaseChangelogConfiguration,
  NxReleaseConfiguration,
  NxReleaseDockerConfiguration,
  NxReleaseGitConfiguration,
  NxReleaseVersionConfiguration,
} from '../../../config/nx-json';
import { ProjectFileMap, ProjectGraph } from '../../../config/project-graph';
import { readJsonFile } from '../../../utils/fileutils';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { output } from '../../../utils/output';
import { PackageJson } from '../../../utils/package-json';
import { normalizePath } from '../../../utils/path';
import { workspaceRoot } from '../../../utils/workspace-root';
import { defaultCreateReleaseProvider as defaultGitHubCreateReleaseProvider } from '../utils/remote-release-clients/github';
import { defaultCreateReleaseProvider as defaultGitLabCreateReleaseProvider } from '../utils/remote-release-clients/gitlab';
import { resolveChangelogRenderer } from '../utils/resolve-changelog-renderer';
import { resolveNxJsonConfigErrorMessage } from '../utils/resolve-nx-json-error-message';
import { DEFAULT_CONVENTIONAL_COMMITS_CONFIG } from './conventional-commits';
import { shouldUseLegacyVersioning } from './use-legacy-versioning';

type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;

type EnsureDockerOptional<T> = {
  [K in keyof T]: Omit<T[K], 'docker'> & {
    docker: DeepRequired<NxReleaseDockerConfiguration> | undefined;
  };
};

type EnsureProjectsArray<T> = {
  [K in keyof T]: T[K] extends { projects: any }
    ? Omit<T[K], 'projects'> & { projects: string[] }
    : T[K];
};

type RemoveTrueFromType<T> = T extends true ? never : T;
type RemoveTrueFromProperties<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? RemoveTrueFromType<T[P]> : T[P];
};
type RemoveTrueFromPropertiesOnEach<T, K extends keyof T[keyof T]> = {
  [U in keyof T]: RemoveTrueFromProperties<T[U], K>;
};
type RemoveBooleanFromType<T> = T extends boolean ? never : T;
type RemoveBooleanFromProperties<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? RemoveBooleanFromType<T[P]> : T[P];
};
type RemoveBooleanFromPropertiesOnEach<T, K extends keyof T[keyof T]> = {
  [U in keyof T]: RemoveBooleanFromProperties<T[U], K>;
};

export const IMPLICIT_DEFAULT_RELEASE_GROUP = '__default__';

export const DEFAULT_VERSION_ACTIONS_PATH =
  '@nx/js/src/release/version-actions';

/**
 * Our source of truth is a deeply required variant of the user-facing config interface, so that command
 * implementations can be sure that properties will exist and do not need to repeat the same checks over
 * and over again.
 *
 * We also normalize the projects property on release groups to always be an array of project names to make
 * it easier to work with (the user could be specifying a single string, and they can also use any valid matcher
 * pattern such as directories and globs).
 */
export type NxReleaseConfig = Omit<
  DeepRequired<
    NxReleaseConfiguration & {
      groups: EnsureDockerOptional<
        DeepRequired<
          RemoveTrueFromPropertiesOnEach<
            EnsureProjectsArray<NxReleaseConfiguration['groups']>,
            'changelog' | 'docker'
          >
        >
      >;
      // Remove the true shorthand from the changelog config types, it will be normalized to a default object
      changelog: RemoveTrueFromProperties<
        DeepRequired<NxReleaseConfiguration['changelog']>,
        'workspaceChangelog' | 'projectChangelogs'
      >;
      // Remove the false shorthand from the conventionalCommits config types, it will be normalized to a semver bump of "none" and to be hidden on the changelog
      conventionalCommits: {
        types: RemoveBooleanFromPropertiesOnEach<
          DeepRequired<
            RemoveBooleanFromProperties<
              DeepRequired<
                NxReleaseConfiguration['conventionalCommits']['types']
              >,
              string
            >
          >,
          'changelog'
        >;
      };
    }
  >,
  // projects is just a shorthand for the default group's projects configuration, it does not exist in the final config
  'projects' | 'docker'
> & {
  // docker is optional and only present when explicitly configured by the user
  docker: DeepRequired<NxReleaseDockerConfiguration> | undefined;
};

// We explicitly handle some possible errors in order to provide the best possible DX
export interface CreateNxReleaseConfigError {
  code:
    | 'PROJECTS_AND_GROUPS_DEFINED'
    | 'RELEASE_GROUP_MATCHES_NO_PROJECTS'
    | 'RELEASE_GROUP_RELEASE_TAG_PATTERN_VERSION_PLACEHOLDER_MISSING_OR_EXCESSIVE'
    | 'PROJECT_MATCHES_MULTIPLE_GROUPS'
    | 'CONVENTIONAL_COMMITS_SHORTHAND_MIXED_WITH_OVERLAPPING_OPTIONS'
    | 'GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG'
    | 'CANNOT_RESOLVE_CHANGELOG_RENDERER'
    | 'INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER'
    | 'INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME'
    | 'INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL'
    | 'GIT_PUSH_FALSE_WITH_CREATE_RELEASE';
  data: Record<string, string | string[]>;
}

// Apply default configuration to any optional user configuration and handle known errors
export async function createNxReleaseConfig(
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap,
  userConfig: NxJsonConfiguration['release'] = {}
): Promise<{
  error: null | CreateNxReleaseConfigError;
  nxReleaseConfig: NxReleaseConfig | null;
}> {
  if (userConfig.projects && userConfig.groups) {
    return {
      error: {
        code: 'PROJECTS_AND_GROUPS_DEFINED',
        data: {},
      },
      nxReleaseConfig: null,
    };
  }

  if (hasInvalidGitConfig(userConfig)) {
    return {
      error: {
        code: 'GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG',
        data: {},
      },
      nxReleaseConfig: null,
    };
  }

  if (hasInvalidConventionalCommitsConfig(userConfig)) {
    return {
      error: {
        code: 'CONVENTIONAL_COMMITS_SHORTHAND_MIXED_WITH_OVERLAPPING_OPTIONS',
        data: {},
      },
      nxReleaseConfig: null,
    };
  }

  const USE_LEGACY_VERSIONING = shouldUseLegacyVersioning(userConfig);

  const gitDefaults = {
    commit: false,
    commitMessage: 'chore(release): publish {version}',
    commitArgs: '',
    tag: false,
    tagMessage: '',
    tagArgs: '',
    stageChanges: false,
    push: false,
    pushArgs: '',
  };
  const versionGitDefaults = {
    ...gitDefaults,
    stageChanges: true,
  };

  const isObjectWithCreateReleaseEnabled = (data: unknown) =>
    typeof data === 'object' &&
    data !== null &&
    'createRelease' in data &&
    (typeof data.createRelease === 'string' ||
      (typeof data.createRelease === 'object' && data.createRelease !== null));

  const isCreateReleaseEnabledAtTheRoot = isObjectWithCreateReleaseEnabled(
    userConfig.changelog?.workspaceChangelog
  );

  const isCreateReleaseEnabledForProjectChangelogs =
    // At the root
    isObjectWithCreateReleaseEnabled(userConfig.changelog?.projectChangelogs) ||
    // Or any release group
    Object.values(userConfig.groups ?? {}).some((group) =>
      isObjectWithCreateReleaseEnabled(group.changelog)
    );

  const isGitPushExplicitlyDisabled =
    userConfig.git?.push === false ||
    userConfig.changelog?.git?.push === false ||
    userConfig.version?.git?.push === false;

  if (
    isGitPushExplicitlyDisabled &&
    (isCreateReleaseEnabledAtTheRoot ||
      isCreateReleaseEnabledForProjectChangelogs)
  ) {
    return {
      error: {
        code: 'GIT_PUSH_FALSE_WITH_CREATE_RELEASE',
        data: {},
      },
      nxReleaseConfig: null,
    };
  }

  const changelogGitDefaults = {
    ...gitDefaults,
    commit: true,
    tag: true,
    push:
      // We have to perform a git push in order to create a release
      isCreateReleaseEnabledAtTheRoot ||
      isCreateReleaseEnabledForProjectChangelogs
        ? true
        : false,
  };

  const defaultFixedReleaseTagPattern = 'v{version}';
  /**
   * TODO(v22): in v22, make it so that this pattern is used by default when any custom groups are used
   */
  const defaultFixedGroupReleaseTagPattern = '{releaseGroupName}-v{version}';
  const defaultIndependentReleaseTagPattern = '{projectName}@{version}';
  const defaultReleaseTagPatternRequireSemver = true;
  /**
   * TODO(v22): in v22, set this to true by default
   */
  const defaultReleaseTagPatternStrictPreid = false;

  const workspaceProjectsRelationship =
    userConfig.projectsRelationship || 'fixed';

  const defaultGeneratorOptions: {
    currentVersionResolver?: string;
    specifierSource?: string;
  } = {};

  if (userConfig.version?.conventionalCommits) {
    defaultGeneratorOptions.currentVersionResolver = 'git-tag';
    defaultGeneratorOptions.specifierSource = 'conventional-commits';
  }
  if (userConfig.versionPlans) {
    defaultGeneratorOptions.specifierSource = 'version-plans';
  }

  const userGroups = Object.values(userConfig.groups ?? {});
  const disableWorkspaceChangelog =
    userGroups.length > 1 ||
    (userGroups.length === 1 &&
      userGroups[0].projectsRelationship === 'independent') ||
    (userConfig.projectsRelationship === 'independent' &&
      !userGroups.some((g) => g.projectsRelationship === 'fixed'));

  const defaultRendererPath = join(
    __dirname,
    '../../../../release/changelog-renderer'
  );
  // Helper function to create meaningful docker defaults when user opts in
  function createDockerDefaults(
    userDockerConfig: NxReleaseDockerConfiguration | true
  ): DeepRequired<NxReleaseDockerConfiguration> {
    const defaultVersionSchemes = {
      production: '{currentDate|YYMM.DD}.{shortCommitSha}',
      hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
    };
    const defaultPreVersionCommand = 'npx nx run-many -t docker:build';

    // If user explicitly sets docker: true, apply meaningful defaults
    if (userDockerConfig === true) {
      return {
        preVersionCommand: defaultPreVersionCommand,
        skipVersionActions: undefined,
        versionSchemes: defaultVersionSchemes,
        repositoryName: undefined,
        registryUrl: undefined,
      };
    }

    // If user provides docker configuration object, merge with base defaults
    return {
      preVersionCommand:
        userDockerConfig.preVersionCommand ?? defaultPreVersionCommand,
      skipVersionActions: userDockerConfig.skipVersionActions
        ? Array.isArray(userDockerConfig.skipVersionActions)
          ? findMatchingProjects(
              userDockerConfig.skipVersionActions,
              projectGraph.nodes
            )
          : userDockerConfig.skipVersionActions
        : undefined,
      versionSchemes: userDockerConfig.versionSchemes ?? defaultVersionSchemes,
      repositoryName: userDockerConfig.repositoryName,
      registryUrl: userDockerConfig.registryUrl,
    };
  }

  // Helper function to normalize docker config at group level
  function normalizeDockerConfig(
    dockerConfig: NxReleaseDockerConfiguration | true
  ): DeepRequired<NxReleaseDockerConfiguration> | undefined {
    // If user explicitly sets docker: true at group level, apply meaningful defaults
    if (dockerConfig === true) {
      return createDockerDefaults(true);
    }

    // If user provides docker configuration object at group level, return it
    if (dockerConfig && typeof dockerConfig === 'object') {
      return createDockerDefaults(dockerConfig);
    }

    // No group-level docker config
    return undefined;
  }

  const WORKSPACE_DEFAULTS: Omit<NxReleaseConfig, 'groups'> = {
    // By default all projects in all groups are released together
    projectsRelationship: workspaceProjectsRelationship,
    // Create docker defaults only if user has explicitly configured it, otherwise undefined
    docker:
      userConfig.docker !== undefined
        ? createDockerDefaults(userConfig.docker)
        : undefined,
    git: gitDefaults,
    version: {
      useLegacyVersioning: USE_LEGACY_VERSIONING,
      git: versionGitDefaults,
      conventionalCommits: userConfig.version?.conventionalCommits || false,
      preVersionCommand: userConfig.version?.preVersionCommand || '',
      ...(USE_LEGACY_VERSIONING
        ? {
            generator: '@nx/js:release-version',
            generatorOptions: defaultGeneratorOptions,
          }
        : {
            versionActions: DEFAULT_VERSION_ACTIONS_PATH,
            versionActionsOptions: {},
            currentVersionResolver:
              defaultGeneratorOptions.currentVersionResolver,
            specifierSource: defaultGeneratorOptions.specifierSource,
            preserveLocalDependencyProtocols:
              (userConfig.version as NxReleaseVersionConfiguration | undefined)
                ?.preserveLocalDependencyProtocols ?? true,
            logUnchangedProjects:
              (userConfig.version as NxReleaseVersionConfiguration | undefined)
                ?.logUnchangedProjects ?? true,
            updateDependents:
              (userConfig.version as NxReleaseVersionConfiguration | undefined)
                ?.updateDependents ?? 'auto',
          }),
    } as DeepRequired<NxReleaseConfiguration['version']>,
    changelog: {
      git: changelogGitDefaults,
      workspaceChangelog: disableWorkspaceChangelog
        ? false
        : {
            createRelease: false,
            entryWhenNoChanges:
              'This was a version bump only, there were no code changes.',
            file: '{workspaceRoot}/CHANGELOG.md',
            renderer: defaultRendererPath,
            renderOptions: {
              authors: true,
              applyUsernameToAuthors: true,
              commitReferences: true,
              versionTitleDate: true,
            },
          },
      // For projectChangelogs if the user has set any changelog config at all, then use one set of defaults, otherwise default to false for the whole feature
      projectChangelogs: userConfig.changelog?.projectChangelogs
        ? {
            createRelease: false,
            file: '{projectRoot}/CHANGELOG.md',
            entryWhenNoChanges:
              'This was a version bump only for {projectName} to align it with other projects, there were no code changes.',
            renderer: defaultRendererPath,
            renderOptions: {
              authors: true,
              applyUsernameToAuthors: true,
              commitReferences: true,
              versionTitleDate: true,
            },
          }
        : false,
      automaticFromRef: false,
    },
    releaseTagPattern:
      userConfig.releaseTagPattern ||
      // The appropriate default releaseTagPattern is dependent upon the projectRelationships
      (workspaceProjectsRelationship === 'independent'
        ? defaultIndependentReleaseTagPattern
        : defaultFixedReleaseTagPattern),
    releaseTagPatternCheckAllBranchesWhen:
      userConfig.releaseTagPatternCheckAllBranchesWhen ?? undefined,
    releaseTagPatternRequireSemver:
      userConfig.releaseTagPatternRequireSemver ??
      defaultReleaseTagPatternRequireSemver,
    releaseTagPatternStrictPreid:
      userConfig.releaseTagPatternStrictPreid ??
      defaultReleaseTagPatternStrictPreid,
    conventionalCommits: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
    versionPlans: (userConfig.versionPlans ||
      false) as NxReleaseConfig['versionPlans'],
  };

  const groupProjectsRelationship =
    userConfig.projectsRelationship || WORKSPACE_DEFAULTS.projectsRelationship;
  const groupReleaseTagPatternRequireSemver =
    userConfig.releaseTagPatternRequireSemver ??
    WORKSPACE_DEFAULTS.releaseTagPatternRequireSemver;
  const groupReleaseTagPatternStrictPreid =
    userConfig.releaseTagPatternStrictPreid ??
    defaultReleaseTagPatternStrictPreid;
  const groupDocker = normalizeDockerConfig(
    userConfig.docker ?? WORKSPACE_DEFAULTS.docker
  );

  const GROUP_DEFAULTS: Omit<
    NxReleaseConfig['groups'][string],
    'projects' | 'docker'
  > & {
    docker:
      | DeepRequired<NxReleaseConfig['groups'][string]['docker']>
      | undefined;
  } = {
    projectsRelationship: groupProjectsRelationship,
    // Only include docker configuration if user has explicitly configured it
    docker:
      groupDocker && Object.keys(groupDocker).length > 0
        ? {
            ...groupDocker,
            groupPreVersionCommand: '',
          }
        : undefined,
    version: USE_LEGACY_VERSIONING
      ? ({
          conventionalCommits: false,
          generator: '@nx/js:release-version',
          generatorOptions: {},
          groupPreVersionCommand: '',
        } as DeepRequired<
          NxReleaseConfiguration['groups']['string']['version']
        >)
      : ({
          conventionalCommits: false,
          versionActions: DEFAULT_VERSION_ACTIONS_PATH,
          versionActionsOptions: {},
          groupPreVersionCommand: '',
        } as DeepRequired<
          NxReleaseConfiguration['groups']['string']['version']
        >),
    changelog: {
      createRelease: false,
      entryWhenNoChanges:
        'This was a version bump only for {projectName} to align it with other projects, there were no code changes.',
      file: '{projectRoot}/CHANGELOG.md',
      renderer: defaultRendererPath,
      renderOptions: {
        authors: true,
        applyUsernameToAuthors: true,
        commitReferences: true,
        versionTitleDate: true,
      },
    },
    releaseTagPattern:
      // The appropriate group default releaseTagPattern is dependent upon the projectRelationships
      groupProjectsRelationship === 'independent'
        ? // If the default pattern contains {projectName} then it will create unique release tags for each project.
          // Otherwise, use the default value to guarantee unique tags
          WORKSPACE_DEFAULTS.releaseTagPattern?.includes('{projectName}')
          ? WORKSPACE_DEFAULTS.releaseTagPattern
          : defaultIndependentReleaseTagPattern
        : WORKSPACE_DEFAULTS.releaseTagPattern,
    releaseTagPatternCheckAllBranchesWhen:
      userConfig.releaseTagPatternCheckAllBranchesWhen ?? undefined,
    releaseTagPatternRequireSemver: groupReleaseTagPatternRequireSemver,
    releaseTagPatternStrictPreid: groupReleaseTagPatternStrictPreid,
    versionPlans: false,
  };

  /**
   * We first process root level config and apply defaults, so that we know how to handle the group level
   * overrides, if applicable.
   */
  const rootGitConfig: NxReleaseConfig['git'] = deepMergeDefaults(
    [WORKSPACE_DEFAULTS.git],
    userConfig.git as Partial<NxReleaseConfig['git']>
  );
  const rootVersionConfig: NxReleaseConfig['version'] = deepMergeDefaults(
    [
      WORKSPACE_DEFAULTS.version,
      // Merge in the git defaults from the top level
      {
        git: versionGitDefaults,
      } as NxReleaseConfig['version'],
      {
        git: userConfig.git as Partial<NxReleaseConfig['git']>,
      } as NxReleaseConfig['version'],
    ],
    userConfig.version as Partial<NxReleaseConfig['version']>
  );

  const rootDockerConfig: NxReleaseConfig['docker'] = userConfig.docker && {
    ...normalizeDockerConfig(WORKSPACE_DEFAULTS.docker),
    ...normalizeDockerConfig(userConfig.docker),
  };

  if (userConfig.changelog?.workspaceChangelog) {
    userConfig.changelog.workspaceChangelog = normalizeTrueToEmptyObject(
      userConfig.changelog.workspaceChangelog
    );
  }
  if (userConfig.changelog?.projectChangelogs) {
    userConfig.changelog.projectChangelogs = normalizeTrueToEmptyObject(
      userConfig.changelog.projectChangelogs
    );
  }

  const rootChangelogConfig: NxReleaseConfig['changelog'] = deepMergeDefaults(
    [
      WORKSPACE_DEFAULTS.changelog,
      // Merge in the git defaults from the top level
      { git: changelogGitDefaults } as NxReleaseConfig['changelog'],
      {
        git: userConfig.git as Partial<NxReleaseConfig['git']>,
      } as NxReleaseConfig['changelog'],
    ],
    normalizeTrueToEmptyObject(userConfig.changelog) as Partial<
      NxReleaseConfig['changelog']
    >
  );

  const rootVersionPlansConfig: NxReleaseConfig['versionPlans'] =
    (userConfig.versionPlans ??
      WORKSPACE_DEFAULTS.versionPlans) as NxReleaseConfig['versionPlans'];

  const rootConventionalCommitsConfig: NxReleaseConfig['conventionalCommits'] =
    deepMergeDefaults(
      [WORKSPACE_DEFAULTS.conventionalCommits],
      fillUnspecifiedConventionalCommitsProperties(
        normalizeConventionalCommitsConfig(
          userConfig.conventionalCommits
        ) as NxReleaseConfig['conventionalCommits']
      )
    );

  // these options are not supported at the group level, only the root/command level
  let rootVersionWithoutGlobalOptions = {
    ...rootVersionConfig,
  } as DeepRequired<
    {
      useLegacyVersioning?: boolean;
      git?: NxReleaseGitConfiguration;
      preVersionCommand?: string;
    } & LegacyNxReleaseVersionConfiguration
  >;
  delete rootVersionWithoutGlobalOptions.git;
  delete rootVersionWithoutGlobalOptions.preVersionCommand;

  // Apply conventionalCommits shorthand to the final group defaults if explicitly configured in the original user config
  if (userConfig.version?.conventionalCommits === true) {
    if (USE_LEGACY_VERSIONING) {
      rootVersionWithoutGlobalOptions.generatorOptions = {
        ...rootVersionWithoutGlobalOptions.generatorOptions,
        currentVersionResolver: 'git-tag',
        specifierSource: 'conventional-commits',
      };
    } else {
      (
        rootVersionWithoutGlobalOptions as NxReleaseVersionConfiguration
      ).currentVersionResolver = 'git-tag';
      (
        rootVersionWithoutGlobalOptions as NxReleaseVersionConfiguration
      ).specifierSource = 'conventional-commits';
    }
  }
  if (userConfig.version?.conventionalCommits === false) {
    delete rootVersionWithoutGlobalOptions.generatorOptions
      ?.currentVersionResolver;
    delete rootVersionWithoutGlobalOptions.generatorOptions?.specifierSource;
    delete (rootVersionWithoutGlobalOptions as NxReleaseVersionConfiguration)
      .currentVersionResolver;
    delete (rootVersionWithoutGlobalOptions as NxReleaseVersionConfiguration)
      .specifierSource;
  }

  // Apply versionPlans shorthand to the final group defaults if explicitly configured in the original user config
  if (userConfig.versionPlans) {
    if (USE_LEGACY_VERSIONING) {
      rootVersionWithoutGlobalOptions.generatorOptions = {
        ...rootVersionWithoutGlobalOptions.generatorOptions,
        specifierSource: 'version-plans',
      };
    } else {
      (
        rootVersionWithoutGlobalOptions as NxReleaseVersionConfiguration
      ).specifierSource = 'version-plans';
    }
  }
  if (userConfig.versionPlans === false) {
    delete rootVersionWithoutGlobalOptions.generatorOptions.specifierSource;
    delete (rootVersionWithoutGlobalOptions as NxReleaseVersionConfiguration)
      .specifierSource;
  }

  const rootDockerWithoutGlobalOptions = { ...rootDockerConfig };
  delete rootDockerWithoutGlobalOptions.preVersionCommand;

  const groups: EnsureDockerOptional<NxReleaseConfig['groups']> =
    userConfig.groups && Object.keys(userConfig.groups).length
      ? ensureProjectsConfigIsArray(userConfig.groups)
      : /**
         * No user specified release groups, so we treat all projects (or any any user-defined subset via the top level "projects" property)
         * as being in one release group together in which the projects are released in lock step.
         */
        {
          [IMPLICIT_DEFAULT_RELEASE_GROUP]: <NxReleaseConfig['groups'][string]>{
            projectsRelationship: GROUP_DEFAULTS.projectsRelationship,
            // Only include docker configuration if user has explicitly configured it
            docker:
              Object.keys(rootDockerWithoutGlobalOptions).length > 0
                ? (deepMergeDefaults(
                    [GROUP_DEFAULTS.docker] as any,
                    rootDockerWithoutGlobalOptions
                  ) as any)
                : undefined,
            projects: userConfig.projects
              ? // user-defined top level "projects" config takes priority if set
                findMatchingProjects(
                  ensureArray(userConfig.projects),
                  projectGraph.nodes
                )
              : await getDefaultProjects(projectGraph, projectFileMap),

            /**
             * For properties which are overriding config at the root, we use the root level config as the
             * default values to merge with so that the group that matches a specific project will always
             * be the valid source of truth for that type of config.
             */
            version: deepMergeDefaults(
              [GROUP_DEFAULTS.version] as any,
              rootVersionWithoutGlobalOptions
            ) as any,
            // If the user has set something custom for releaseTagPattern at the top level, respect it for the implicit default group
            releaseTagPattern:
              userConfig.releaseTagPattern || GROUP_DEFAULTS.releaseTagPattern,
            releaseTagPatternRequireSemver:
              userConfig.releaseTagPatternRequireSemver ??
              GROUP_DEFAULTS.releaseTagPatternRequireSemver,
            // Directly inherit the root level config for projectChangelogs, if set
            changelog: rootChangelogConfig.projectChangelogs || false,
            versionPlans: rootVersionPlansConfig || GROUP_DEFAULTS.versionPlans,
          },
        };

  /**
   * Resolve all the project names into their release groups, and check
   * that individual projects are not found in multiple groups.
   */
  const releaseGroups: EnsureDockerOptional<NxReleaseConfig['groups']> = {};
  const alreadyMatchedProjects = new Set<string>();

  for (const [releaseGroupName, releaseGroup] of Object.entries(groups)) {
    // Ensure that the config for the release group can resolve at least one project
    const matchingProjects = findMatchingProjects(
      releaseGroup.projects,
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

    // If provided, ensure release tag pattern is valid
    if (releaseGroup.releaseTagPattern) {
      const error = ensureReleaseGroupReleaseTagPatternIsValid(
        releaseGroup.releaseTagPattern,
        releaseGroupName
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

    // First apply any group level defaults, then apply actual root level config (if applicable), then group level config
    const groupChangelogDefaults: Array<
      NxReleaseConfig['groups']['string']['changelog']
    > = [GROUP_DEFAULTS.changelog];
    if (rootChangelogConfig.projectChangelogs) {
      groupChangelogDefaults.push(rootChangelogConfig.projectChangelogs);
    }

    const projectsRelationship =
      releaseGroup.projectsRelationship || GROUP_DEFAULTS.projectsRelationship;

    if (releaseGroup.changelog) {
      releaseGroup.changelog = normalizeTrueToEmptyObject(
        releaseGroup.changelog
      ) as NxReleaseConfig['groups']['string']['changelog'];
    }

    const normalizedGroupDockerConfig = normalizeDockerConfig(
      releaseGroup.docker
    );

    // Only include docker configuration if user has explicitly configured it at root or group level
    const shouldIncludeDockerConfig =
      Object.keys(rootDockerWithoutGlobalOptions).length > 0 ||
      normalizedGroupDockerConfig !== undefined;

    const groupDefaults: NxReleaseConfig['groups']['string'] = {
      projectsRelationship,
      // Only include docker configuration if user has explicitly configured it
      docker: shouldIncludeDockerConfig
        ? {
            ...GROUP_DEFAULTS.docker,
            ...rootDockerWithoutGlobalOptions,
            groupPreVersionCommand: '',
            ...releaseGroup.docker,
          }
        : undefined,
      projects: matchingProjects,
      version: deepMergeDefaults(
        // First apply any group level defaults, then apply actual root level config, then group level config
        [
          GROUP_DEFAULTS.version as any,
          { ...rootVersionWithoutGlobalOptions, groupPreVersionCommand: '' },
        ],
        releaseGroup.version
      ),
      // If the user has set any changelog config at all, including at the root level, then use one set of defaults, otherwise default to false for the whole feature
      changelog:
        releaseGroup.changelog || rootChangelogConfig.projectChangelogs
          ? deepMergeDefaults<NxReleaseConfig['groups']['string']['changelog']>(
              groupChangelogDefaults,
              releaseGroup.changelog || {}
            )
          : false,
      releaseTagPattern:
        releaseGroup.releaseTagPattern ||
        // The appropriate group default releaseTagPattern is dependent upon the projectRelationships
        (projectsRelationship === 'independent'
          ? // If the default pattern contains {projectName} then it will create unique release tags for each project.
            // Otherwise, use the default value to guarantee unique tags
            userConfig.releaseTagPattern?.includes('{projectName}')
            ? userConfig.releaseTagPattern
            : defaultIndependentReleaseTagPattern
          : userConfig.releaseTagPattern || defaultFixedReleaseTagPattern),
      releaseTagPatternCheckAllBranchesWhen:
        releaseGroup.releaseTagPatternCheckAllBranchesWhen ??
        userConfig.releaseTagPatternCheckAllBranchesWhen ??
        undefined,
      releaseTagPatternRequireSemver:
        releaseGroup.releaseTagPatternRequireSemver ??
        userConfig.releaseTagPatternRequireSemver ??
        defaultReleaseTagPatternRequireSemver,
      releaseTagPatternStrictPreid:
        releaseGroup.releaseTagPatternStrictPreid ??
        userConfig.releaseTagPatternStrictPreid ??
        defaultReleaseTagPatternStrictPreid,
      versionPlans: releaseGroup.versionPlans ?? rootVersionPlansConfig,
    };

    const finalReleaseGroup = deepMergeDefaults([groupDefaults], {
      ...releaseGroup,
      // Ensure that the resolved project names take priority over the original user config (which could have contained unresolved globs etc)
      projects: matchingProjects,
    });

    finalReleaseGroup.version =
      finalReleaseGroup.version as unknown as DeepRequired<
        LegacyNxReleaseVersionConfiguration & {
          groupPreVersionCommand?: string;
        }
      >;

    // Clean up docker global options that are not supported at the group level
    if (finalReleaseGroup.docker) {
      delete finalReleaseGroup.docker.preVersionCommand;
    }

    // Apply conventionalCommits shorthand to the final group if explicitly configured in the original group
    if (releaseGroup.version?.conventionalCommits === true) {
      if (USE_LEGACY_VERSIONING) {
        finalReleaseGroup.version.generatorOptions = {
          ...finalReleaseGroup.version.generatorOptions,
          currentVersionResolver: 'git-tag',
          specifierSource: 'conventional-commits',
        };
      } else {
        (
          finalReleaseGroup.version as NxReleaseVersionConfiguration
        ).currentVersionResolver = 'git-tag';
        (
          finalReleaseGroup.version as NxReleaseVersionConfiguration
        ).specifierSource = 'conventional-commits';
      }
    }
    if (
      releaseGroup.version?.conventionalCommits === false &&
      releaseGroupName !== IMPLICIT_DEFAULT_RELEASE_GROUP
    ) {
      if (USE_LEGACY_VERSIONING) {
        delete finalReleaseGroup.version.generatorOptions
          ?.currentVersionResolver;
        delete finalReleaseGroup.version.generatorOptions?.specifierSource;
      }
      delete (finalReleaseGroup.version as NxReleaseVersionConfiguration)
        .currentVersionResolver;
      delete (finalReleaseGroup.version as NxReleaseVersionConfiguration)
        .specifierSource;
    }

    // Apply versionPlans shorthand to the final group if explicitly configured in the original group
    if (releaseGroup.versionPlans) {
      if (USE_LEGACY_VERSIONING) {
        finalReleaseGroup.version = {
          ...finalReleaseGroup.version,
          generatorOptions: {
            ...finalReleaseGroup.version?.generatorOptions,
            specifierSource: 'version-plans',
          },
        };
      } else {
        (
          finalReleaseGroup.version as NxReleaseVersionConfiguration
        ).specifierSource = 'version-plans';
      }
    }
    if (
      releaseGroup.versionPlans === false &&
      releaseGroupName !== IMPLICIT_DEFAULT_RELEASE_GROUP
    ) {
      if (USE_LEGACY_VERSIONING) {
        delete finalReleaseGroup.version.generatorOptions?.specifierSource;
      }
      delete (finalReleaseGroup.version as NxReleaseVersionConfiguration)
        .specifierSource;
    }
    releaseGroups[releaseGroupName] = finalReleaseGroup;
  }

  // Infer docker-related properties based on project configurations
  for (const [releaseGroupName, releaseGroup] of Object.entries(
    releaseGroups
  )) {
    const hasDockerProjects = releaseGroup.projects.some((projectName) => {
      const projectNode = projectGraph.nodes[projectName];
      // Check if project has meaningful docker config (not just undefined/empty values)
      const projectDockerConfig = projectNode?.data.release?.docker;
      const hasProjectDockerConfig = projectDockerConfig !== undefined;

      // Check if release group has docker config at all (since we now only include it when explicitly configured)
      const hasGroupDockerConfig = !!releaseGroup.docker;

      return hasProjectDockerConfig || hasGroupDockerConfig;
    });

    if (hasDockerProjects) {
      // If any project in the group has docker configuration, disable semver requirement
      releaseGroup.releaseTagPatternRequireSemver = false;
    }
  }

  const configError = validateChangelogConfig(
    releaseGroups,
    rootChangelogConfig
  );
  if (configError) {
    return {
      error: configError,
      nxReleaseConfig: null,
    };
  }

  return {
    error: null,
    nxReleaseConfig: {
      projectsRelationship: WORKSPACE_DEFAULTS.projectsRelationship,
      // Only include docker configuration if user has explicitly configured it
      ...(WORKSPACE_DEFAULTS.docker
        ? { docker: WORKSPACE_DEFAULTS.docker }
        : {}),
      releaseTagPattern: WORKSPACE_DEFAULTS.releaseTagPattern,
      releaseTagPatternCheckAllBranchesWhen:
        WORKSPACE_DEFAULTS.releaseTagPatternCheckAllBranchesWhen,
      releaseTagPatternRequireSemver:
        WORKSPACE_DEFAULTS.releaseTagPatternRequireSemver,
      releaseTagPatternStrictPreid:
        WORKSPACE_DEFAULTS.releaseTagPatternStrictPreid,
      git: rootGitConfig,
      docker: rootDockerConfig,
      version: rootVersionConfig,
      changelog: rootChangelogConfig,
      groups: releaseGroups,
      conventionalCommits: rootConventionalCommitsConfig,
      versionPlans: rootVersionPlansConfig,
    },
  };
}

/**
 * In some cases it is much cleaner and more intuitive for the user to be able to
 * specify `true` in their config when they want to use the default config for a
 * particular property, rather than having to specify an empty object.
 */
function normalizeTrueToEmptyObject<T>(value: T | boolean): T | {} {
  return value === true ? {} : value;
}

function normalizeConventionalCommitsConfig(
  userConventionalCommitsConfig: NxJsonConfiguration['release']['conventionalCommits']
): NxJsonConfiguration['release']['conventionalCommits'] {
  if (!userConventionalCommitsConfig || !userConventionalCommitsConfig.types) {
    return userConventionalCommitsConfig;
  }

  const types: NxJsonConfiguration['release']['conventionalCommits']['types'] =
    {};
  for (const [t, typeConfig] of Object.entries(
    userConventionalCommitsConfig.types
  )) {
    if (typeConfig === false) {
      types[t] = {
        semverBump: 'none',
        changelog: {
          hidden: true,
        },
      };
      continue;
    }
    if (typeConfig === true) {
      types[t] = {};
      continue;
    }
    if (typeConfig.changelog === false) {
      types[t] = {
        ...typeConfig,
        changelog: {
          hidden: true,
        },
      };
      continue;
    }
    if (typeConfig.changelog === true) {
      types[t] = {
        ...typeConfig,
        changelog: {},
      };
      continue;
    }

    types[t] = typeConfig;
  }

  return {
    ...userConventionalCommitsConfig,
    types,
  };
}

/**
 * New, custom types specified by users will not be given the appropriate
 * defaults with `deepMergeDefaults`, so we need to fill in the gaps here.
 */
function fillUnspecifiedConventionalCommitsProperties(
  config: NxReleaseConfig['conventionalCommits']
) {
  if (!config || !config.types) {
    return config;
  }
  const types: NxReleaseConfig['conventionalCommits']['types'] = {};
  for (const [t, typeConfig] of Object.entries(config.types)) {
    const defaultTypeConfig = DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types[t];

    const semverBump =
      typeConfig.semverBump ||
      // preserve our default semver bump if it's not 'none'
      // this prevents a 'feat' from becoming a 'patch' just
      // because they modified the changelog config for 'feat'
      (defaultTypeConfig?.semverBump !== 'none' &&
        defaultTypeConfig?.semverBump) ||
      'patch';
    // don't preserve our default behavior for hidden, ever.
    // we should assume that if users are explicitly enabling a
    // type, then they intend it to be visible in the changelog
    const hidden = typeConfig.changelog?.hidden || false;
    const title =
      typeConfig.changelog?.title ||
      // our default title is better than just the unmodified type name
      defaultTypeConfig?.changelog.title ||
      t;

    types[t] = {
      semverBump,
      changelog: {
        hidden,
        title,
      },
    };
  }
  return {
    ...config,
    types,
  };
}

export async function handleNxReleaseConfigError(
  error: CreateNxReleaseConfigError,
  useLegacyVersioning: boolean
): Promise<never> {
  const linkMessage = `\nRead more about Nx Release at https://nx.dev/features/manage-releases.`;
  switch (error.code) {
    case 'PROJECTS_AND_GROUPS_DEFINED':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
          'projects',
        ]);
        output.error({
          title: `"projects" is not valid when explicitly defining release groups, and everything should be expressed within "groups" in that case. If you are using "groups" then you should remove the "projects" property`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'RELEASE_GROUP_MATCHES_NO_PROJECTS':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
          'groups',
        ]);
        output.error({
          title: `Release group "${error.data.releaseGroupName}" matches no projects. Please ensure all release groups match at least one project:`,
          bodyLines: [nxJsonMessage, linkMessage],
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
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'RELEASE_GROUP_RELEASE_TAG_PATTERN_VERSION_PLACEHOLDER_MISSING_OR_EXCESSIVE':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
          'groups',
          error.data.releaseGroupName as string,
          'releaseTagPattern',
        ]);
        output.error({
          title: `Release group "${error.data.releaseGroupName}" has an invalid releaseTagPattern. Please ensure the pattern contains exactly one instance of the "{version}" placeholder`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'CONVENTIONAL_COMMITS_SHORTHAND_MIXED_WITH_OVERLAPPING_OPTIONS':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
        ]);
        const text = useLegacyVersioning
          ? '"version.generatorOptions"'
          : 'configuration options';
        output.error({
          title: `You have configured both the shorthand "version.conventionalCommits" and one or more of the related ${text} that it sets for you. Please use one or the other:`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
          'git',
        ]);
        output.error({
          title: `You have duplicate conflicting git configurations. If you are using the top level 'nx release' command, then remove the 'release.version.git' and 'release.changelog.git' properties in favor of 'release.git'. If you are using the subcommands or the programmatic API, then remove the 'release.git' property in favor of 'release.version.git' and 'release.changelog.git':`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'CANNOT_RESOLVE_CHANGELOG_RENDERER': {
      const nxJsonMessage = await resolveNxJsonConfigErrorMessage(['release']);
      output.error({
        title: `There was an error when resolving the configured changelog renderer at path: ${error.data.workspaceRelativePath}`,
        bodyLines: [nxJsonMessage, linkMessage],
      });
      break;
    }
    case 'INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
        ]);
        output.error({
          title: `Your "changelog.createRelease" config specifies an unsupported provider "${
            error.data.provider
          }". The supported providers are ${(
            error.data.supportedProviders as string[]
          )
            .map((p) => `"${p}"`)
            .join(', ')}`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
        ]);
        output.error({
          title: `Your "changelog.createRelease" config specifies an invalid hostname "${error.data.hostname}". Please ensure you provide a valid hostname value, such as "example.com"`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
        ]);
        output.error({
          title: `Your "changelog.createRelease" config specifies an invalid apiBaseUrl "${error.data.apiBaseUrl}". Please ensure you provide a valid URL value, such as "https://example.com"`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    case 'GIT_PUSH_FALSE_WITH_CREATE_RELEASE':
      {
        const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
          'release',
        ]);
        output.error({
          title: `The createRelease option for changelogs cannot be enabled when git push is explicitly disabled because the commit needs to be pushed to the remote in order to tie the release to it`,
          bodyLines: [nxJsonMessage, linkMessage],
        });
      }
      break;
    default:
      throw new Error(`Unhandled error code: ${error.code}`);
  }

  process.exit(1);
}

function ensureReleaseGroupReleaseTagPatternIsValid(
  releaseTagPattern: string,
  releaseGroupName: string
): null | CreateNxReleaseConfigError {
  // ensure that any provided releaseTagPattern contains exactly one instance of {version}
  return releaseTagPattern.split('{version}').length === 2
    ? null
    : {
        code: 'RELEASE_GROUP_RELEASE_TAG_PATTERN_VERSION_PLACEHOLDER_MISSING_OR_EXCESSIVE',
        data: {
          releaseGroupName,
        },
      };
}

function ensureProjectsConfigIsArray(
  groups: NxJsonConfiguration['release']['groups']
): NxReleaseConfig['groups'] {
  const result: NxJsonConfiguration['release']['groups'] = {};
  for (const [groupName, groupConfig] of Object.entries(groups)) {
    result[groupName] = {
      ...groupConfig,
      projects: ensureArray(groupConfig.projects),
    };
  }
  return result as NxReleaseConfig['groups'];
}

function ensureArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function isObject(value: any): value is Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value);
}

// Helper function to merge two config objects
function mergeConfig<T>(
  objA: DeepRequired<T>,
  objB: Partial<T>
): DeepRequired<T> {
  const merged: any = { ...objA };

  for (const key in objB) {
    if (objB.hasOwnProperty(key)) {
      // If objB[key] is explicitly set to false, null or 0, respect that value
      if (objB[key] === false || objB[key] === null || objB[key] === 0) {
        merged[key] = objB[key];
      }
      // If both objA[key] and objB[key] are objects, recursively merge them
      else if (isObject(merged[key]) && isObject(objB[key])) {
        merged[key] = mergeConfig(merged[key], objB[key]);
      }
      // If objB[key] is defined, use it (this will overwrite any existing value in merged[key])
      else if (objB[key] !== undefined) {
        merged[key] = objB[key];
      }
    }
  }

  return merged as DeepRequired<T>;
}

/**
 * This function takes in a strictly typed collection of all possible default values in a particular section of config,
 * and an optional set of partial user config, and returns a single, deeply merged config object, where the user
 * config takes priority over the defaults in all cases (only an `undefined` value in the user config will be
 * overwritten by the defaults, all other falsey values from the user will be respected).
 */
function deepMergeDefaults<T>(
  defaultConfigs: DeepRequired<T>[],
  userConfig?: Partial<T>
): DeepRequired<T> {
  let result: any;

  // First merge defaultConfigs sequentially (meaning later defaults will override earlier ones)
  for (const defaultConfig of defaultConfigs) {
    if (!result) {
      result = defaultConfig;
      continue;
    }
    result = mergeConfig(result, defaultConfig as Partial<T>);
  }

  // Finally, merge the userConfig
  if (userConfig) {
    result = mergeConfig(result, userConfig);
  }

  return result as DeepRequired<T>;
}

/**
 * We want to prevent users from setting both the conventionalCommits shorthand and any of the related
 * configuration options at the same time, since it is at best redundant, and at worst invalid.
 */
function hasInvalidConventionalCommitsConfig(
  userConfig: NxJsonConfiguration['release']
): boolean {
  // at the root
  if (
    userConfig.version?.conventionalCommits === true &&
    // v2 config - directly on version config
    ((userConfig.version as NxReleaseVersionConfiguration)
      ?.currentVersionResolver ||
      (userConfig.version as NxReleaseVersionConfiguration)?.specifierSource ||
      // Legacy config - on generatorOptions
      (userConfig.version as LegacyNxReleaseVersionConfiguration)
        ?.generatorOptions?.currentVersionResolver ||
      (userConfig.version as LegacyNxReleaseVersionConfiguration)
        ?.generatorOptions?.specifierSource)
  ) {
    return true;
  }
  // within any groups
  if (userConfig.groups) {
    for (const group of Object.values(userConfig.groups)) {
      if (
        group.version?.conventionalCommits === true &&
        // v2 config - directly on version config
        ((group.version as NxReleaseVersionConfiguration)
          ?.currentVersionResolver ||
          (group.version as NxReleaseVersionConfiguration)?.specifierSource ||
          // Legacy config - on generatorOptions
          (group.version as LegacyNxReleaseVersionConfiguration)
            ?.generatorOptions?.currentVersionResolver ||
          (group.version as LegacyNxReleaseVersionConfiguration)
            ?.generatorOptions?.specifierSource)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * We want to prevent users from setting both the global and granular git configurations. Users should prefer the
 * global configuration if using the top level nx release command and the granular configuration if using
 * the subcommands or the programmatic API.
 */
function hasInvalidGitConfig(
  userConfig: NxJsonConfiguration['release']
): boolean {
  return (
    !!userConfig.git && !!(userConfig.version?.git || userConfig.changelog?.git)
  );
}

async function getDefaultProjects(
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap
): Promise<string[]> {
  // default to all library projects in the workspace with a package.json file
  return findMatchingProjects(['*'], projectGraph.nodes).filter(
    (project) =>
      projectGraph.nodes[project].type === 'lib' &&
      // Exclude all projects with "private": true in their package.json because this is
      // a common indicator that a project is not intended for release.
      // Users can override this behavior by explicitly defining the projects they want to release.
      isProjectPublic(project, projectGraph, projectFileMap)
  );
}

function isProjectPublic(
  project: string,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap
): boolean {
  const projectNode = projectGraph.nodes[project];
  const packageJsonPath = join(projectNode.data.root, 'package.json');

  if (
    !projectFileMap[project]?.find(
      (f) => f.file === normalizePath(packageJsonPath)
    )
  ) {
    return false;
  }

  try {
    const fullPackageJsonPath = join(workspaceRoot, packageJsonPath);
    const packageJson = readJsonFile<PackageJson>(fullPackageJsonPath);
    return !(packageJson.private === true);
  } catch (e) {
    // do nothing and assume that the project is not public if there is a parsing issue
    // this will result in it being excluded from the default projects list
    return false;
  }
}

/**
 * We need to ensure that changelog renderers are resolvable up front so that we do not end up erroring after performing
 * actions later, and we also make sure that any configured createRelease options are valid.
 *
 * For the createRelease config, we also set a default apiBaseUrl if applicable.
 */
function validateChangelogConfig(
  releaseGroups: NxReleaseConfig['groups'],
  rootChangelogConfig: NxReleaseConfig['changelog']
): CreateNxReleaseConfigError | null {
  /**
   * If any form of changelog config is enabled, ensure that any provided changelog renderers are resolvable
   * up front so that we do not end up erroring only after the versioning step has been completed.
   */
  const uniqueRendererPaths = new Set<string>();

  if (
    rootChangelogConfig.workspaceChangelog &&
    typeof rootChangelogConfig.workspaceChangelog !== 'boolean'
  ) {
    if (rootChangelogConfig.workspaceChangelog.renderer?.length) {
      uniqueRendererPaths.add(rootChangelogConfig.workspaceChangelog.renderer);
    }
    const createReleaseError = validateCreateReleaseConfig(
      rootChangelogConfig.workspaceChangelog
    );
    if (createReleaseError) {
      return createReleaseError;
    }
  }
  if (
    rootChangelogConfig.projectChangelogs &&
    typeof rootChangelogConfig.projectChangelogs !== 'boolean'
  ) {
    if (rootChangelogConfig.projectChangelogs.renderer?.length) {
      uniqueRendererPaths.add(rootChangelogConfig.projectChangelogs.renderer);
    }
    const createReleaseError = validateCreateReleaseConfig(
      rootChangelogConfig.projectChangelogs
    );
    if (createReleaseError) {
      return createReleaseError;
    }
  }

  for (const group of Object.values(releaseGroups)) {
    if (group.changelog && typeof group.changelog !== 'boolean') {
      if (group.changelog.renderer?.length) {
        uniqueRendererPaths.add(group.changelog.renderer);
      }
      const createReleaseError = validateCreateReleaseConfig(group.changelog);
      if (createReleaseError) {
        return createReleaseError;
      }
    }
  }

  if (!uniqueRendererPaths.size) {
    return null;
  }

  for (const rendererPath of uniqueRendererPaths) {
    try {
      resolveChangelogRenderer(rendererPath);
    } catch {
      return {
        code: 'CANNOT_RESOLVE_CHANGELOG_RENDERER',
        data: {
          workspaceRelativePath: relative(workspaceRoot, rendererPath),
        },
      };
    }
  }

  return null;
}

const supportedCreateReleaseProviders = [
  {
    name: 'github-enterprise-server',
    defaultApiBaseUrl: 'https://__hostname__/api/v3',
  },
  {
    name: 'gitlab',
    defaultApiBaseUrl: 'https://__hostname__/api/v4',
  },
];

/**
 * Full form of the createRelease config, with the provider, hostname, and apiBaseUrl resolved.
 */
export interface ResolvedCreateRemoteReleaseProvider {
  provider: string;
  hostname: string;
  apiBaseUrl: string;
}

function validateCreateReleaseConfig(
  changelogConfig: NxReleaseChangelogConfiguration
): CreateNxReleaseConfigError | null {
  const createRelease = changelogConfig.createRelease;
  // Disabled: valid
  if (!createRelease) {
    return null;
  }
  // GitHub shorthand, expand to full object form, mark as valid
  if (createRelease === 'github') {
    changelogConfig.createRelease =
      defaultGitHubCreateReleaseProvider as unknown as NxReleaseChangelogConfiguration['createRelease'];
    return null;
  }
  // Gitlab shorthand, expand to full object form, mark as valid
  if (createRelease === 'gitlab') {
    changelogConfig.createRelease =
      defaultGitLabCreateReleaseProvider as unknown as NxReleaseChangelogConfiguration['createRelease'];
    return null;
  }
  // Object config, ensure that properties are valid
  const supportedProvider = supportedCreateReleaseProviders.find(
    (p) => p.name === createRelease.provider
  );
  if (!supportedProvider) {
    return {
      code: 'INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER',
      data: {
        provider: createRelease.provider,
        supportedProviders: supportedCreateReleaseProviders.map((p) => p.name),
      },
    };
  }
  if (!isValidHostname(createRelease.hostname)) {
    return {
      code: 'INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME',
      data: {
        hostname: createRelease.hostname,
      },
    };
  }
  // user provided a custom apiBaseUrl, ensure it is valid (accounting for empty string case)
  if (
    createRelease.apiBaseUrl ||
    typeof createRelease.apiBaseUrl === 'string'
  ) {
    if (!isValidUrl(createRelease.apiBaseUrl)) {
      return {
        code: 'INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL',
        data: {
          apiBaseUrl: createRelease.apiBaseUrl,
        },
      };
    }
  } else {
    // Set default apiBaseUrl when not provided by the user
    createRelease.apiBaseUrl = supportedProvider.defaultApiBaseUrl.replace(
      '__hostname__',
      createRelease.hostname
    );
  }
  return null;
}

function isValidHostname(hostname) {
  // Regular expression to match a valid hostname
  const hostnameRegex =
    /^(?!:\/\/)(?=.{1,255}$)(?!.*\.$)(?!.*?\.\.)(?!.*?-$)(?!^-)([a-zA-Z0-9-]{1,63}\.?)+[a-zA-Z]{2,}$/;
  return hostnameRegex.test(hostname);
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
