import { existsSync } from 'fs';
import { dirname, join } from 'path';

import type { ChangelogRenderOptions } from '../../release/changelog-renderer';
import { readJsonFile } from '../utils/fileutils';
import { PackageManager } from '../utils/package-manager';
import { workspaceRoot } from '../utils/workspace-root';
import {
  InputDefinition,
  TargetConfiguration,
  TargetDependencyConfig,
} from './workspace-json-project-json';

export type ImplicitDependencyEntry<T = '*' | string[]> = {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
};

export interface ImplicitJsonSubsetDependency<T = '*' | string[]> {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
}

/**
 * @deprecated Use {@link NxJsonConfiguration#defaultBase } instead
 */
export interface NxAffectedConfig {
  /**
   * Default based branch used by affected commands.
   */
  defaultBase?: string;
}

export type TargetDefaults = Record<string, Partial<TargetConfiguration>>;

export type TargetDependencies = Record<
  string,
  (TargetDependencyConfig | string)[]
>;

export interface NrwlJsPluginConfig {
  analyzeSourceFiles?: boolean;
  analyzePackageJson?: boolean;
  analyzeLockfile?: boolean;
  projectsAffectedByDependencyUpdates?: 'all' | 'auto' | string[];
}

interface NxInstallationConfiguration {
  /**
   * Version used for Nx
   */
  version: string;
  /**
   * Record<pluginPackageName, pluginVersion>. e.g.
   * plugins: { '@nx/angular': '1.0.0' }
   */
  plugins?: Record<string, string>;
}

export interface NxReleaseVersionConfiguration {
  generator?: string;
  generatorOptions?: Record<string, unknown>;
  /**
   * Enabling support for parsing semver bumps via conventional commits and reading the current version from
   * git tags is so common that we have a first class shorthand for it, which is false by default.
   *
   * Setting this to true is the same as adding the following to version.generatorOptions:
   * - currentVersionResolver: "git-tag"
   * - specifierSource: "conventional-commits"
   *
   * If the user attempts to mix and match these options with the shorthand, we will provide a helpful error.
   */
  conventionalCommits?: boolean;
}

export interface NxReleaseChangelogConfiguration {
  /**
   * Optionally create a release containing all relevant changes on a supported version control system, it
   * is false by default.
   *
   * NOTE: if createRelease is set on a group of projects, it will cause the default releaseTagPattern of
   * "{projectName}@{version}" to be used for those projects, even when versioning everything together.
   */
  createRelease?: 'github' | false;
  /**
   * This can either be set to a string value that will be written to the changelog file(s)
   * at the workspace root and/or within project directories, or set to `false` to specify
   * that no changelog entry should be made when there are no code changes.
   *
   * NOTE: The string value has a sensible default value and supports interpolation of
   * {projectName} when generating for project level changelogs.
   *
   * E.g. for a project level changelog you could customize the message to something like:
   * "entryWhenNoChanges": "There were no code changes for {projectName}"
   */
  entryWhenNoChanges?: string | false;
  /**
   * This is either a workspace path where the changelog markdown file will be created and read from,
   * or set to false to disable file creation altogether (e.g. if only using Github releases).
   *
   * Interpolation of {projectName}, {projectRoot} and {workspaceRoot} is supported.
   *
   * The defaults are:
   * - "{workspaceRoot}/CHANGELOG.md" at the workspace level
   * - "{projectRoot}/CHANGELOG.md" at the project level
   */
  file?: string | false;
  /**
   * A path to a valid changelog renderer function used to transform commit messages and other metadata into
   * the final changelog (usually in markdown format). Its output can be modified using the optional `renderOptions`.
   *
   * By default, the renderer is set to "nx/release/changelog-renderer" which nx provides out of the box.
   */
  renderer?: string;
  renderOptions?: ChangelogRenderOptions;
}

export interface NxReleaseGitConfiguration {
  /**
   * Whether or not to automatically commit the changes made by current command
   */
  commit?: boolean;
  /**
   * Custom git commit message to use when committing the changes made by this command {version} will be dynamically interpolated when performing fixed releases, interpolated tags will be appended to the commit body when performing independent releases.
   */
  commitMessage?: string;
  /**
   * Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the `git commit` command invoked behind the scenes
   */
  commitArgs?: string;
  /**
   * Whether or not to stage the changes made by this command. Always treated as true if commit is true.
   */
  stageChanges?: boolean;
  /**
   * Whether or not to automatically tag the changes made by this command
   */
  tag?: boolean;
  /**
   * Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself.
   */
  tagMessage?: string;
  /**
   * Additional arguments to pass to the `git tag` command invoked behind the scenes
   */
  tagArgs?: string;
}

export interface NxReleaseConventionalCommitsConfiguration {
  types?: Record<
    string,
    /**
     * A map of commit types to their configuration.
     * If a type is set to 'true', then it will be enabled with the default 'semverBump' of 'patch' and will appear in the changelog.
     * If a type is set to 'false', then it will not trigger a version bump and will be hidden from the changelog.
     */
    | {
        /**
         * The semver bump to apply when a commit of this type is found.
         * If set to "none", the commit will be ignored for versioning purposes.
         */
        semverBump?: 'patch' | 'minor' | 'major' | 'none';
        /**
         * Configuration for the changelog section for commits of this type.
         * If set to 'true', then commits of this type will be included in the changelog with their default title for the type.
         * If set to 'false', then commits of this type will not be included in the changelog.
         */
        changelog?:
          | {
              title?: string;
              hidden?: boolean;
            }
          | boolean;
      }
    | boolean
  >;
}

interface NxReleaseConfiguration {
  /**
   * Shorthand for amending the projects which will be included in the implicit default release group (all projects by default).
   * @note Only one of `projects` or `groups` can be specified, the cannot be used together.
   */
  projects?: string[] | string;
  /**
   * @note When no projects or groups are configured at all (the default), all projects in the workspace are treated as
   * if they were in a release group together with a fixed relationship.
   */
  groups?: Record<
    string, // group name
    {
      /**
       * Whether to version and release projects within the group independently, or together in lock step ("fixed").
       * If not set on the group, this will be informed by the projectsRelationship config at the top level.
       */
      projectsRelationship?: 'fixed' | 'independent';
      /**
       * Required list of one or more projects to include in the release group. Any single project can
       * only be used in a maximum of one release group.
       */
      projects: string[] | string;
      /**
       * Optionally override version configuration for this group.
       *
       * NOTE: git configuration is not supported at the group level, only the root/command level
       */
      version?: NxReleaseVersionConfiguration;
      /**
       * Project changelogs are disabled by default.
       *
       * Here you can optionally override project changelog configuration for this group.
       * Notes about boolean values:
       *
       * - true = enable project level changelogs using default configuration
       * - false = explicitly disable project level changelogs
       *
       * NOTE: git configuration is not supported at the group level, only the root/command level
       */
      changelog?: NxReleaseChangelogConfiguration | boolean;
      /**
       * Optionally override the git/release tag pattern to use for this group.
       */
      releaseTagPattern?: string;
      /**
       * Enables using version plans as a specifier source for versioning and
       * to determine changes for changelog generation.
       */
      versionPlans?: boolean;
    }
  >;
  /**
   * Configures the default value for all groups that don't explicitly state their own projectsRelationship.
   *
   * By default, this is set to "fixed" which means all projects in the workspace will be versioned and
   * released together in lock step.
   */
  projectsRelationship?: 'fixed' | 'independent';
  changelog?: {
    /**
     * Enable or override configuration for git operations as part of the changelog subcommand
     */
    git?: NxReleaseGitConfiguration;
    /**
     * Workspace changelog is enabled by default. Notes about boolean values:
     *
     * - true = explicitly enable workspace changelog using default configuration
     * - false = disable workspace changelog
     */
    workspaceChangelog?: NxReleaseChangelogConfiguration | boolean;
    /**
     * Project changelogs are disabled by default. Notes about boolean values:
     *
     * - true = enable project level changelogs using default configuration
     * - false = explicitly disable project level changelogs
     */
    projectChangelogs?: NxReleaseChangelogConfiguration | boolean;
    /**
     * Whether or not to automatically look up the first commit for the workspace (or package, if versioning independently)
     * and use that as the starting point for changelog generation. If this is not enabled, changelog generation will fail
     * if there is no previous matching git tag to use as a starting point.
     */
    automaticFromRef?: boolean;
  };
  /**
   * If no version config is provided, we will assume that @nx/js:release-version
   * is the desired generator implementation, allowing for terser config for the common case.
   */
  version?: NxReleaseVersionConfiguration & {
    /**
     * Enable or override configuration for git operations as part of the version subcommand
     */
    git?: NxReleaseGitConfiguration;
    /**
     * A command to run after validation of nx release configuration, but before versioning begins.
     * Used for preparing build artifacts. If --dry-run is passed, the command is still executed, but
     * with the NX_DRY_RUN environment variable set to 'true'.
     */
    preVersionCommand?: string;
  };
  /**
   * Optionally override the git/release tag pattern to use. This field is the source of truth
   * for changelog generation and release tagging, as well as for conventional commits parsing.
   *
   * It supports interpolating the version as {version} and (if releasing independently or forcing
   * project level version control system releases) the project name as {projectName} within the string.
   *
   * The default releaseTagPattern for fixed/unified releases is: "v{version}"
   * The default releaseTagPattern for independent releases at the project level is: "{projectName}@{version}"
   */
  releaseTagPattern?: string;
  /**
   * Enable and configure automatic git operations as part of the release
   */
  git?: NxReleaseGitConfiguration;
  conventionalCommits?: NxReleaseConventionalCommitsConfiguration;
  /**
   * Enables using version plans as a specifier source for versioning and
   * to determine changes for changelog generation.
   */
  versionPlans?: boolean;
}

/**
 * Nx.json configuration
 *
 * @note: when adding properties here add them to `allowedWorkspaceExtensions` in adapter/compat.ts
 */
export interface NxJsonConfiguration<T = '*' | string[]> {
  /**
   * Optional (additional) Nx.json configuration file which becomes a base for this one
   */
  extends?: string;
  /**
   * Map of files to projects that implicitly depend on them
   * @deprecated use {@link namedInputs} instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies
   */
  implicitDependencies?: ImplicitDependencyEntry<T>;
  /**
   * Named inputs targets can refer to reduce duplication
   */
  namedInputs?: { [inputName: string]: (string | InputDefinition)[] };
  /**
   * Dependencies between different target names across all projects
   */
  targetDefaults?: TargetDefaults;
  /**
   * Default options for `nx affected`
   * @deprecated use {@link defaultBase} instead. For more information see https://nx.dev/deprecated/affected-config#affected-config
   */
  affected?: NxAffectedConfig;

  /**
   * Default value for --base used by `nx affected` and `nx format`.
   */
  defaultBase?: string;

  /**
   * Where new apps + libs should be placed
   *
   * @deprecated Workspace Layout will be removed in Nx v20. Pass the full `--directory` option to the generators instead.
   */
  workspaceLayout?: {
    libsDir?: string;
    appsDir?: string;
  };
  /**
   * Available Task Runners
   */
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      /**
       * Path to resolve the runner
       */
      runner?: string;
      /**
       * Default options for the runner
       */
      options?: any;
    };
  };
  /**
   * List of default values used by generators.
   *
   * These defaults are global. They are used when no other defaults are configured.
   *
   * Example:
   *
   * ```
   * {
   *   "@nx/react": {
   *     "library": {
   *       "style": "scss"
   *     }
   *   }
   * }
   * ```
   */
  generators?: { [collectionName: string]: { [generatorName: string]: any } };

  /**
   * Default generator collection. It is used when no collection is provided.
   */
  cli?: {
    packageManager?: PackageManager;

    defaultProjectName?: string;
  };
  /**
   * Plugins for extending the project graph
   */
  plugins?: PluginConfiguration[];

  /**
   * Configuration for Nx Plugins
   */
  pluginsConfig?: Record<string, Record<string, unknown>>;

  /**
   * Default project. When project isn't provided, the default project
   * will be used. Convenient for small workspaces with one main application.
   */
  defaultProject?: string;

  /**
   * Configures the Nx installation for a repo. Useful for maintaining  a separate
   * set of dependencies for Nx + Plugins compared to the base package.json, but also
   * useful for workspaces that don't have a root package.json + node_modules.
   */
  installation?: NxInstallationConfiguration;

  /**
   * Configuration for `nx release` (versioning and publishing of applications and libraries)
   */
  release?: NxReleaseConfiguration;

  /**
   * If specified Nx will use nx-cloud by default with the given token.
   * To use a different runner that accepts an access token, define it in {@link tasksRunnerOptions}
   */
  nxCloudAccessToken?: string;

  /**
   * Specifies the url pointing to an instance of nx cloud. Used for remote
   * caching and displaying run links.
   */
  nxCloudUrl?: string;

  /**
   * Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.
   */
  nxCloudEncryptionKey?: string;

  /**
   * Specifies how many tasks can be run in parallel.
   */
  parallel?: number;

  /**
   * Changes the directory used by Nx to store its cache.
   */
  cacheDirectory?: string;

  /**
   * Set this to false to disable the daemon.
   */
  useDaemonProcess?: boolean;

  /**
   * Set this to false to disable adding inference plugins when generating new projects
   */
  useInferencePlugins?: boolean;
}

export type PluginConfiguration = string | ExpandedPluginConfiguration;

export type ExpandedPluginConfiguration<T = unknown> = {
  plugin: string;
  options?: T;
  include?: string[];
  exclude?: string[];
};

export function readNxJson(root: string = workspaceRoot): NxJsonConfiguration {
  const nxJson = join(root, 'nx.json');
  if (existsSync(nxJson)) {
    const nxJsonConfiguration = readJsonFile<NxJsonConfiguration>(nxJson);
    if (nxJsonConfiguration.extends) {
      const extendedNxJsonPath = require.resolve(nxJsonConfiguration.extends, {
        paths: [dirname(nxJson)],
      });
      const baseNxJson = readJsonFile<NxJsonConfiguration>(extendedNxJsonPath);
      return {
        ...baseNxJson,
        ...nxJsonConfiguration,
      };
    } else {
      return nxJsonConfiguration;
    }
  } else {
    try {
      return readJsonFile(join(__dirname, '..', '..', 'presets', 'core.json'));
    } catch (e) {
      return {};
    }
  }
}

export function hasNxJson(root: string): boolean {
  const nxJson = join(root, 'nx.json');
  return existsSync(nxJson);
}
