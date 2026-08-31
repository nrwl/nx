import type { JsonInput } from '../native';
import type { PackageJson } from '../utils/package-json';
import type {
  NxJsonConfiguration,
  NxReleaseDockerConfiguration,
  NxReleaseVersionConfiguration,
} from './nx-json';

/**
 * @deprecated use ProjectsConfigurations or NxJsonConfiguration
 */
export interface Workspace extends ProjectsConfigurations, NxJsonConfiguration {
  projects: Record<string, ProjectConfiguration>;
}

/**
 * @deprecated use ProjectsConfigurations
 */
export type WorkspaceJsonConfiguration = ProjectsConfigurations;

/**
 * Projects Configurations
 * @note: when adding properties here add them to `allowedWorkspaceExtensions` in adapter/compat.ts
 */
export interface ProjectsConfigurations {
  /**
   * Version of the configuration format
   */
  version: number;
  /**
   * Projects' projects
   */
  projects: {
    [projectName: string]: ProjectConfiguration;
  };
}

/**
 * Type of project supported
 */
export type ProjectType = 'library' | 'application';

/**
 * Project configuration
 *
 * @note: when adding properties here add them to `allowedProjectExtensions` in adapter/compat.ts
 */
export interface ProjectConfiguration {
  /**
   * Project's name. Optional if specified in workspace.json
   */
  name?: string;

  /**
   * Project's targets
   */
  targets?: { [targetName: string]: TargetConfiguration };

  /**
   * Project's location relative to the root of the workspace
   */
  root: string;

  /**
   * The location of project's sources relative to the root of the workspace
   */
  sourceRoot?: string;

  /**
   * Project type
   */
  projectType?: ProjectType;

  /**
   * List of default values used by generators.
   *
   * These defaults are project specific.
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
   * List of projects which are added as a dependency
   */
  implicitDependencies?: string[];

  /**
   * Named inputs targets can refer to reduce duplication
   */
  namedInputs?: { [inputName: string]: (string | InputDefinition)[] };

  /**
   * List of tags used by enforce-module-boundaries / project graph
   */
  tags?: string[];

  /**
   * Project specific configuration for `nx release`
   */
  release?: {
    version?: Pick<
      // Expose a subset of version config options at the project level
      NxReleaseVersionConfiguration,
      | 'versionActions'
      | 'versionActionsOptions'
      | 'manifestRootsToUpdate'
      | 'currentVersionResolver'
      | 'currentVersionResolverMetadata'
      | 'fallbackCurrentVersionResolver'
      | 'versionPrefix'
      | 'preserveLocalDependencyProtocols'
    >;
    docker?: NxReleaseDockerConfiguration | true;
  };

  /**
   * Metadata about the project
   */
  metadata?: ProjectMetadata;
}

export interface ProjectMetadata {
  [k: string]: any;

  description?: string;
  technologies?: string[];
  targetGroups?: Record<string, string[]>;
  owners?: {
    [ownerId: string]: {
      ownedFiles: {
        files: ['*'] | string[];
        fromConfig?: {
          filePath: string;
          location: {
            startLine: number;
            endLine: number;
          };
        };
      }[];
    };
  };
  js?: {
    packageName: string;
    packageVersion?: string;
    packageExports?: PackageJson['exports'];
    packageMain?: string;
    isInPackageManagerWorkspaces?: boolean;
  };
  dotnet?: {
    /**
     * The project's evaluated NuGet package identity, set only when every evaluated target
     * framework agrees on it (see `DotnetTargetFrameworkMetadata.packageId`). Undefined when no
     * target framework evaluates one, or when they disagree — e.g. a conditional `PackageId`
     * that varies per `TargetFramework` — since a single project-level value would misrepresent
     * one of the frameworks. Consult each entry in `targetFrameworks` for the per-framework
     * identity in that case.
     */
    packageId?: string;
    capabilities: DotnetCapabilities;
    targetFrameworks: DotnetTargetFrameworkMetadata[];
  };
}

/**
 * Capabilities describing what operations a .NET project (or one of its evaluated target
 * frameworks) supports. These overlap rather than being mutually exclusive: a project can be
 * both a test project and packable, for example.
 */
export interface DotnetCapabilities {
  /** Opts in via `IsTestProject` or references the test SDK/platform packages. */
  test: boolean;
  /** The evaluated `OutputType` is `Exe`. */
  executable: boolean;
  /** The evaluated `IsPackable` property allows `dotnet pack` to produce a NuGet package. */
  packable: boolean;
  /** The evaluated `IsPublishable` property allows `dotnet publish` to produce output. */
  publishable: boolean;
  /** The evaluated `PackAsTool` property packages this project as a .NET tool. */
  tool: boolean;
}

/**
 * Evaluated MSBuild facts for a single target framework of a .NET project (one MSBuild "inner
 * build"). Multi-targeted projects (`TargetFrameworks`) contribute one entry per framework;
 * single-targeted projects contribute exactly one.
 */
export interface DotnetTargetFrameworkMetadata {
  /**
   * The evaluated NuGet package identity for this target framework: the evaluated `PackageId`
   * property, falling back to `AssemblyName` when unset (matching the NuGet packaging SDK's own
   * default resolution), or undefined if neither is evaluated.
   */
  packageId?: string;
  /** The evaluated `TargetFramework` short name (e.g. "net9.0", "net9.0-ios"). */
  targetFramework: string;
  /** The evaluated `TargetFrameworkIdentifier` (e.g. ".NETCoreApp"). */
  targetFrameworkIdentifier?: string;
  /** The evaluated `TargetFrameworkVersion` (e.g. "v9.0"). */
  targetFrameworkVersion?: string;
  /** The evaluated `TargetPlatformIdentifier` (e.g. "ios", "android", "windows"), when set. */
  targetPlatformIdentifier?: string;
  /** The evaluated `TargetPlatformVersion`, set alongside `targetPlatformIdentifier`. */
  targetPlatformVersion?: string;
  /** The evaluated single `RuntimeIdentifier` for this target framework, if set. */
  runtimeIdentifier?: string;
  /** The evaluated `RuntimeIdentifiers` list for this target framework (multi-RID publish). */
  runtimeIdentifiers: string[];
  /** Capabilities evaluated for this specific target framework. */
  capabilities: DotnetCapabilities;
}

export interface TargetMetadata {
  [k: string]: any;

  description?: string;
  technologies?: string[];
  nonAtomizedTarget?: string;
  help?: {
    command: string;
    example: {
      options?: Record<string, unknown>;
      args?: string[];
    };
  };
}

export interface TargetDependencyConfig {
  /**
   * A list of projects that have `target`.
   * Should not be specified together with `dependencies`.
   */
  projects?: string[] | string;

  /**
   * If true, the target will be executed for each project that this project depends on.
   * Should not be specified together with `projects`.
   */
  dependencies?: boolean;

  /**
   * The name of the target to run. If `projects` and `dependencies` are not specified,
   * the target will be executed for the same project the the current target is running on`.
   */
  target: string;

  /**
   * Whether to forward CLI params to the dependency target.
   */
  params?: 'ignore' | 'forward';

  /**
   * Whether to forward task options to the dependency target.
   */
  options?: 'ignore' | 'forward';
}

// TODO: import the remaining variants from '../native' so the TS types stay
// in sync with the Rust/napi-generated shapes. Some variants (fileset/input
// discrimination, workingDirectory literal union) carry richer TS semantics
// than their native counterparts and will need a layered type to preserve.
export type InputDefinition =
  | { input: string; projects: string | string[] }
  | { input: string; dependencies: true }
  | { input: string }
  | { fileset: string }
  | { fileset: string; dependencies: true }
  | { runtime: string }
  | { externalDependencies: string[] }
  | { dependentTasksOutputFiles: string; transitive?: boolean }
  | { env: string }
  | { workingDirectory: 'relative' | 'absolute' }
  | JsonInput;

/**
 * Target's configuration
 */
export interface TargetConfiguration<T = any> {
  /**
   * The executor/builder used to implement the target.
   *
   * Example: '@nx/rollup:rollup'
   */
  executor?: string;

  /**
   * Used as a shorthand for nx:run-commands, a command to run.
   */
  command?: string;

  /**
   * List of the target's outputs. The outputs will be cached by the Nx computation
   * caching engine.
   */
  outputs?: string[];

  /**
   * This describes other targets that a target depends on.
   */
  dependsOn?: (TargetDependencyConfig | string)[];

  /**
   * This describes filesets, runtime dependencies and other inputs that a target depends on.
   */
  inputs?: (InputDefinition | string)[];

  /**
   * Target's options. They are passed in to the executor.
   */
  options?: T;

  /**
   * Sets of options
   */
  configurations?: { [config: string]: any };

  /**
   * A default named configuration to use when a target configuration is not provided.
   */
  defaultConfiguration?: string;

  /**
   * Determines if Nx is able to cache a given target.
   */
  cache?: boolean;

  /**
   * Metadata about the target
   */
  metadata?: TargetMetadata;

  /**
   * Whether this target can be run in parallel with other tasks
   * Default is true
   */
  parallelism?: boolean;

  /**
   * Whether this target runs continuously
   */
  continuous?: boolean;

  /**
   * List of generators to run before the target to ensure the workspace
   * is up to date.
   */
  syncGenerators?: string[];

  /**
   * Spread token used when merging target configurations. When set to `true`,
   * base (inferred) values take priority over this target's values for any
   * shared keys — effectively "only add new keys without overwriting inferred
   * values". Keys that do not exist in the base target are still added.
   *
   * The position of `'...'` in the object's key order follows standard
   * last-write-wins semantics with {@link https://nx.dev/reference/project-configuration#spread-token}.
   */
  '...'?: true;
}
