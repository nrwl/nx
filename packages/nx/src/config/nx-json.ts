import { existsSync } from 'fs';
import { dirname, join } from 'path';

import type { ChangelogRenderOptions } from '../../changelog-renderer';
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

/**
 * **ALPHA**
 */
interface NxReleaseVersionConfiguration {
  generator?: string;
  generatorOptions?: Record<string, unknown>;
}

/**
 * **ALPHA**
 */
export interface NxReleaseChangelogConfiguration {
  /**
   * Optionally create a release containing all relevant changes on a supported version control system, it
   * is false by default.
   *
   * NOTE: if createRelease is set on a group of projects, it will cause the default releaseTagPattern of
   * "{projectName}@v{version}" to be used for those projects, even when versioning everything together.
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
   * By default, the renderer is set to "nx/changelog-renderer" which nx provides out of the box.
   */
  renderer?: string;
  renderOptions?: ChangelogRenderOptions;
}

/**
 * **ALPHA**
 */
interface NxReleaseConfiguration {
  /**
   * @note: When no groups are configured at all (the default), all projects in the workspace are treated as
   * if they were in a release group together.
   */
  groups?: Record<
    string, // group name
    {
      /**
       * Required list of one or more projects to include in the release group. Any single project can
       * only be used in a maximum of one release group.
       */
      projects: string[] | string;
      /**
       * Optionally override version configuration for this group.
       */
      version?: NxReleaseVersionConfiguration;
      /**
       * Optionally override project changelog configuration for this group.
       */
      changelog?: NxReleaseChangelogConfiguration | false;
      /**
       * Optionally override the git/release tag pattern to use for this group.
       */
      releaseTagPattern?: string;
    }
  >;
  changelog?: {
    workspaceChangelog?: NxReleaseChangelogConfiguration | false;
    projectChangelogs?: NxReleaseChangelogConfiguration | false;
  };
  /**
   * If no version config is provided, we will assume that @nx/js:release-version
   * is the desired generator implementation, allowing for terser config for the common case.
   */
  version?: NxReleaseVersionConfiguration;
  /**
   * Optional override the git/release tag pattern to use. This field is the source of truth
   * for changelog generation and release tagging, as well as for conventional-commits parsing.
   *
   * It supports interpolating the version as {version} and (if releasing independently or forcing
   * project level version control system releases) the project name as {projectName} within the string.
   *
   * The default releaseTagPattern for unified releases is: "v{version}"
   * The default releaseTagPattern for releases at the project level is: "{projectName}@v{version}"
   */
  releaseTagPattern?: string;
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
   */
  affected?: NxAffectedConfig;
  /**
   * Where new apps + libs should be placed
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
   * **ALPHA**: Configuration for `nx release` (versioning and publishing of applications and libraries)
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
}

export type PluginConfiguration =
  | string
  | { plugin: string; options?: unknown };

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
