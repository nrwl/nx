import { join } from 'node:path';
import { ReleaseType } from 'semver';
import { NxReleaseVersionConfiguration } from '../../../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { registerTsProject } from '../../../plugins/js/utils/register';
import { getRootTsConfigPath } from '../../../plugins/js/utils/typescript';
import { interpolate } from '../../../tasks-runner/utils';
import { workspaceRoot } from '../../../utils/workspace-root';
import { DEFAULT_VERSION_ACTIONS_PATH } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import {
  deriveNewSemverVersion,
  isRelativeVersionKeyword,
} from '../utils/semver';
import {
  BUMP_TYPE_REASON_TEXT,
  FinalConfigForProject,
} from './release-group-processor';

export type SemverBumpType = ReleaseType | 'none';

function resolveVersionActionsPath(
  path: string,
  projectGraphNode: ProjectGraphProjectNode
): string {
  try {
    return require.resolve(path);
  } catch {
    try {
      return require.resolve(join(workspaceRoot, path));
    } catch {
      if (path === DEFAULT_VERSION_ACTIONS_PATH) {
        throw new Error(
          `Unable to resolve the default "versionActions" implementation for project "${projectGraphNode.name}" at path: "${path}"

- If this is a JavaScript/TypeScript project, it is likely that you simply need to install the "@nx/js" plugin.

- If this not a JavaScript/TypeScript project, you can should provide an alternative "versionActions" implementation path via the "release.version.versionActions" configuration option.
`
        );
      }
      throw new Error(
        `Unable to resolve the "versionActions" implementation for project "${projectGraphNode.name}" at the configured path: "${path}"`
      );
    }
  }
}

/**
 * Implementation details of performing any actions after all projects have been versioned.
 * An example might be updating a workspace level lock file.
 *
 * NOTE: By the time this function is invoked, the tree will have been flushed back to disk,
 * so it is not accessible here.
 *
 * The function should return lists of changed and deleted files so that they can be staged
 * and committed if appropriate.
 *
 * NOTE: The versionActionsOptions passed here are the ones at the root of release.version config,
 * different values per release group or project will not be respected here because this takes
 * place after all projects have been versioned.
 */
export type AfterAllProjectsVersioned = (
  cwd: string,
  opts: {
    dryRun?: boolean;
    verbose?: boolean;
    rootVersionActionsOptions?: Record<string, unknown>;
  }
) => Promise<{
  changedFiles: string[];
  deletedFiles: string[];
}>;

type VersionActionsConstructor = {
  new (
    releaseGroup: ReleaseGroupWithName,
    projectGraphNode: ProjectGraphProjectNode,
    finalConfigForProject: FinalConfigForProject
  ): VersionActions;
};

const versionActionsResolutionCache = new Map<
  string,
  {
    VersionActionsClass: VersionActionsConstructor;
    afterAllProjectsVersioned: AfterAllProjectsVersioned;
  }
>();

export async function resolveVersionActionsForProject(
  tree: Tree,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode,
  finalConfigForProject: FinalConfigForProject,
  isInProjectsToProcess: boolean
): Promise<{
  versionActionsPath: string;
  versionActions: VersionActions;
  afterAllProjectsVersioned: AfterAllProjectsVersioned;
}> {
  // Project level release version config takes priority, if set
  const projectVersionConfig = projectGraphNode.data.release?.version as
    | Pick<
        NxReleaseVersionConfiguration,
        'versionActions' | 'versionActionsOptions'
      >
    | undefined;
  const releaseGroupVersionConfig = releaseGroup.version as
    | Pick<
        NxReleaseVersionConfiguration,
        'versionActions' | 'versionActionsOptions'
      >
    | undefined;

  const versionActionsPathConfig =
    projectVersionConfig?.versionActions ??
    releaseGroupVersionConfig?.versionActions ??
    null;
  if (!versionActionsPathConfig) {
    // Should be an impossible state, as we should have defaulted to the JS implementation during config processing
    throw new Error(
      `No versionActions implementation found for project "${projectGraphNode.name}", please report this on https://github.com/nrwl/nx/issues`
    );
  }

  let cachedData = versionActionsResolutionCache.get(versionActionsPathConfig);
  const versionActionsPath = resolveVersionActionsPath(
    versionActionsPathConfig,
    projectGraphNode
  );

  let VersionActionsClass: VersionActionsConstructor | undefined;
  let afterAllProjectsVersioned: AfterAllProjectsVersioned | undefined;

  if (cachedData) {
    VersionActionsClass = cachedData.VersionActionsClass;
    afterAllProjectsVersioned = cachedData.afterAllProjectsVersioned;
  } else {
    let cleanupTranspiler: () => void;
    if (versionActionsPath.endsWith('.ts')) {
      cleanupTranspiler = registerTsProject(getRootTsConfigPath());
    }
    const loaded = require(versionActionsPath);
    cleanupTranspiler?.();
    VersionActionsClass = loaded.default ?? loaded;
    if (!VersionActionsClass) {
      throw new Error(
        `For project "${projectGraphNode.name}" it was not possible to resolve the VersionActions implementation from: "${versionActionsPath}"`
      );
    }
    afterAllProjectsVersioned =
      loaded.afterAllProjectsVersioned ??
      // no-op fallback for ecosystems/use-cases where it is not applicable
      (() =>
        Promise.resolve({
          changedFiles: [],
          deletedFiles: [],
        }));
    versionActionsResolutionCache.set(versionActionsPath, {
      VersionActionsClass,
      afterAllProjectsVersioned,
    });
  }
  const versionActions: VersionActions = new VersionActionsClass(
    releaseGroup,
    projectGraphNode,
    finalConfigForProject
  );
  // Initialize the version actions with all the required manifest paths etc
  await versionActions.init(tree, isInProjectsToProcess);
  return {
    versionActionsPath,
    versionActions,
    afterAllProjectsVersioned,
  };
}

export abstract class VersionActions {
  /**
   * The available valid filenames of the manifest file relevant to the current versioning use-case.
   *
   * E.g. for JavaScript projects this would be ["package.json"], but for Gradle it would be
   * ["build.gradle", "build.gradle.kts"].
   *
   * If a manifest file is not applicable to the current versioning use-case, this should be set to null.
   */
  abstract validManifestFilenames: string[] | null;
  /**
   * The interpolated manifest paths to update, if applicable based on the user's configuration, when new
   * versions and dependencies are determined. If no manifest files should be updated based on the user's
   * configuration, this will be an empty array.
   *
   * The final value for preserveLocalDependencyProtocols will be based on the resolved config for the current
   * project and any overrides from the user's configuration for the manifestRootsToUpdate.
   */
  manifestsToUpdate: {
    manifestPath: string;
    preserveLocalDependencyProtocols: boolean;
  }[] = [];

  constructor(
    public releaseGroup: ReleaseGroupWithName,
    public projectGraphNode: ProjectGraphProjectNode,
    public finalConfigForProject: FinalConfigForProject
  ) {}

  /**
   * Asynchronous initialization of the version actions and validation of certain configuration options.
   */
  async init(tree: Tree, isInProjectsToProcess: boolean): Promise<void> {
    // Default to the first available source manifest root, if applicable, if no custom manifest roots are provided
    if (
      this.validManifestFilenames?.length &&
      this.finalConfigForProject.manifestRootsToUpdate.length === 0
    ) {
      for (const manifestFilename of this.validManifestFilenames) {
        if (
          tree.exists(join(this.projectGraphNode.data.root, manifestFilename))
        ) {
          this.finalConfigForProject.manifestRootsToUpdate.push({
            path: this.projectGraphNode.data.root,
            preserveLocalDependencyProtocols:
              this.finalConfigForProject.preserveLocalDependencyProtocols,
          });
          break;
        }
      }
    }

    const interpolatedManifestRoots =
      this.finalConfigForProject.manifestRootsToUpdate.map((manifestRoot) => {
        return {
          ...manifestRoot,
          path: interpolate(manifestRoot.path, {
            workspaceRoot: '',
            projectRoot: this.projectGraphNode.data.root,
            projectName: this.projectGraphNode.name,
          }),
        };
      });

    for (const interpolatedManifestRoot of interpolatedManifestRoots) {
      let hasValidManifest = false;
      for (const manifestFilename of this.validManifestFilenames) {
        const manifestPath = join(
          interpolatedManifestRoot.path,
          manifestFilename
        );
        if (tree.exists(manifestPath)) {
          this.manifestsToUpdate.push({
            ...interpolatedManifestRoot,
            manifestPath,
          });
          hasValidManifest = true;
          break;
        }
      }
      /**
       * If projects or groups filters are applied, it is possible that the project is not being actively processed
       * and we should not throw an error in this case.
       */
      if (!hasValidManifest && isInProjectsToProcess) {
        const validManifestFilenames =
          this.validManifestFilenames?.join(' or ');

        throw new Error(
          `The project "${this.projectGraphNode.name}" does not have a ${validManifestFilenames} file available in ./${interpolatedManifestRoot.path}.

To fix this you will either need to add a ${validManifestFilenames} file at that location, or configure "release" within your nx.json to exclude "${this.projectGraphNode.name}" from the current release group, or amend the "release.version.manifestRootsToUpdate" configuration to point to where the relevant manifest should be.

It is also possible that the project is being processed because of a dependency relationship between what you are directly versioning and the project/release group, in which case you will need to amend your filters to include all relevant projects and release groups.`
        );
      }
    }
  }

  /**
   * The default implementation will calculate the new version based on semver. If semver is not applicable to a
   * particular versioning use-case, this method should be overridden with custom logic.
   *
   * @param {string | null} currentVersion - The current version of the project, or null if the current version resolver is set to 'none'
   * @param {string} newVersionInput - The new version input provided by the user, such as a semver relative bump type, or an explicit version
   * @param {string} newVersionInputReason - The reason for the new version input used to inform the log message to show to the user
   * @param {Record<string, unknown>} newVersionInputReasonData - The data to interpolate into the new version input reason
   * @param {string} preid - The preid to use for the new version, if applicable
   */
  async calculateNewVersion(
    currentVersion: string | null,
    newVersionInput: string,
    newVersionInputReason: string,
    newVersionInputReasonData: Record<string, unknown>,
    preid: string
  ): Promise<{
    newVersion: string;
    logText: string;
  }> {
    const isSemverRelativeBump = isRelativeVersionKeyword(newVersionInput);
    const newVersionReasonText = BUMP_TYPE_REASON_TEXT[newVersionInputReason];
    if (!newVersionReasonText) {
      throw new Error(
        `Unhandled bump type reason for ${this.projectGraphNode.name} with newVersionInput ${newVersionInput} and newVersionInputReason ${newVersionInputReason}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    const interpolatedNewVersionInputReasonText = interpolate(
      newVersionReasonText,
      newVersionInputReasonData
    );
    if (isSemverRelativeBump && !currentVersion) {
      throw new Error(
        `There was no current version resolved for project "${this.projectGraphNode.name}", but it was configured to be bumped via a semver relative keyword "${newVersionInput}"${interpolatedNewVersionInputReasonText}. This is not a valid combination, please review your release configuration and CLI arguments`
      );
    }

    const newVersion = deriveNewSemverVersion(
      currentVersion,
      newVersionInput,
      preid
    );

    const newVersionInputText = isRelativeVersionKeyword(newVersionInput)
      ? `semver relative bump "${newVersionInput}"`
      : `explicit semver value "${newVersionInput}"`;

    return {
      newVersion,
      logText: `❓ Applied ${newVersionInputText}${interpolatedNewVersionInputReasonText}to get new version ${newVersion}`,
    };
  }

  /**
   * Implementation details of resolving a project's current version from a valid manifest file. It should
   * return an object with the current version and the filename of the resolved manifest path so that the
   * logs provided to the user are as specific as possible.
   *
   * This method will only be called if the user has configured their currentVersionResolver to be "disk".
   *
   * If the version actions implementation does not support a manifest file, this method can either throw
   * an error or return null. In this case, nx release will handle showing the user a relevant error about
   * their currentVersionResolver configuration being fundamentally incompatible with the current version
   * actions implementation resolved for the project being versioned and they can change it to something else
   * (e.g. "registry" or "git-tag").
   *
   * NOTE: The version actions implementation does not need to provide the method for handling resolution
   * from git tags, this is done directly by nx release.
   */
  abstract readCurrentVersionFromSourceManifest(tree: Tree): Promise<{
    currentVersion: string;
    manifestPath: string;
  } | null>;

  /**
   * Implementation details of resolving a project's current version from a remote registry.
   *
   * The specific logText it returns will be combined with the generic remote registry log text and allows
   * the implementation to provide more specific information to the user about what registry URL
   * was used, what dist-tag etc.
   *
   * If the version actions implementation does not support resolving from a remote registry, this method
   * can either throw an error or return null. In this case, nx release will handle showing the user a relevant
   * error about their currentVersionResolver configuration being fundamentally incompatible with the current
   * version actions implementation resolved for the project being versioned and they can change it to something
   * else (e.g. "disk" or "git-tag").
   *
   * NOTE: The version actions implementation does not need to provide the method for handling resolution
   * from git tags, this is done directly by nx release.
   */
  abstract readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string | null;
    logText: string;
  } | null>;

  /**
   * Implementation details of resolving the dependencies of a project.
   *
   * The default implementation will read dependencies from the Nx project graph. In many cases this will be sufficient,
   * because the project graph will have been constructed using plugins from relevant ecosystems that should have applied
   * any and all relevant metadata to the project nodes and dependency edges.
   *
   * If, however, the project graph cannot be used as the source of truth for whatever reason, then this default method
   * can simply be overridden in the final version actions implementation.
   */
  async readDependencies(
    tree: Tree,
    projectGraph: ProjectGraph
  ): Promise<ProjectGraphDependency[]> {
    return (projectGraph.dependencies[this.projectGraphNode.name] ?? []).filter(
      // Skip implicit dependencies for now to match legacy versioning behavior
      // TODO: holistically figure out how to handle implicit dependencies with nx release
      (dep) => dep.type !== 'implicit'
    );
  }

  /**
   * Implementation details of resolving the current version of a specific dependency of the project.
   *
   * The dependency collection is the type of dependency collection to which the dependency belongs, such as 'dependencies',
   * 'devDependencies', 'peerDependencies', 'optionalDependencies', etc. This is ecosystem and use-case specific.
   *
   * The currentVersion and dependencyCollection fields will be used to populate the rawVersionSpec and dependencyCollection
   * fields on the VersionData that gets returned from the programmatic API. `null` values are accepted for these if the current
   * version or dependencyCollection is not applicable/resolvable at all, but they should be provided if possible.
   *
   * The currentVersion will also be used when calculating the final versionPrefix to apply for the new dependency
   * version, based on the user's configuration, if applicable.
   */
  abstract readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }>;

  /**
   * Implementation details of updating a newly derived version in some source of truth.
   *
   * For libraries/packages, this will usually involve writing to one or more manifest files
   * (e.g. potentially both src and dist), such as a package.json/Cargo.toml/etc, but for
   * application deployments it might involve updating something else instead, it depends on
   * the type of application.
   *
   * It should return an array of log messages that will be displayed unmodified to the user
   * after the version has been updated.
   */
  abstract updateProjectVersion(
    tree: Tree,
    newVersion: string
  ): Promise<string[]>;

  /**
   * Implementation details of updating dependencies in some source of truth.
   *
   * For libraries/packages, this will usually involve writing to one or more manifest files
   * (e.g. potentially both src and dist), such as a package.json/Cargo.toml/etc,
   * with new dependency versions, but for application deployments it might involve
   * updating something else instead, it depends on the type of application.
   *
   * It should return an array of log messages that will be displayed unmodified to the user
   * after the dependencies have been updated.
   */
  abstract updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]>;
}

export class NOOP_VERSION_ACTIONS extends VersionActions {
  validManifestFilenames = null;

  readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string | null;
    logText: string;
  } | null> {
    return Promise.resolve(null);
  }

  readCurrentVersionFromSourceManifest(
    tree: Tree
  ): Promise<{ currentVersion: string; manifestPath: string } | null> {
    return Promise.resolve(null);
  }

  readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    return Promise.resolve({
      currentVersion: null,
      dependencyCollection: null,
    });
  }

  async calculateNewVersion(
    currentVersion: string | null,
    newVersionInput: string,
    newVersionInputReason: string,
    newVersionInputReasonData: Record<string, unknown>,
    preid: string
  ): Promise<{
    newVersion: string;
    logText: string;
  }> {
    return Promise.resolve({
      newVersion: '0.0.0',
      logText: 'Skipped default versioning as no-op.',
    });
  }

  updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    return Promise.resolve([]);
  }

  updateProjectVersion(tree: Tree, newVersion: string): Promise<string[]> {
    return Promise.resolve([]);
  }
}
