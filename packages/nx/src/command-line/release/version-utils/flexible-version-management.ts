import { join } from 'node:path';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { workspaceRoot } from '../../../utils/workspace-root';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { deriveNewSemverVersion } from '../utils/semver';
import { ReleaseVersionGeneratorSchema } from '../version';

export type SpecifierSource =
  | 'prompt'
  | 'conventional-commits'
  | 'version-plans';
export type SemverBumpType = 'major' | 'minor' | 'patch' | 'none';
export type SideEffectBumpType = SemverBumpType | 'same-as-dependency';

// TODO: Implement this
export function deriveSpecifierFromVersionPlan(
  projectPath: string
): SemverBumpType {
  return 'patch';
}

function resolveManifestActionsPath(path: string): string {
  try {
    return require.resolve(path);
  } catch {
    try {
      return require.resolve(join(workspaceRoot, path));
    } catch {
      throw new Error(`Unable to resolve manifest actions path "${path}"`);
    }
  }
}

let JsManifestActions;

export async function resolveManifestActionsForProject(
  tree: Tree,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode
): Promise<{
  manifestActionsPath: string;
  ManifestActionsClass: typeof ManifestActions;
  manifestActions: ManifestActions;
}> {
  // Project level "release" config takes priority
  // TODO: Update release config type to include manifestActions
  const manifestActionsPathConfig =
    typeof (projectGraphNode.data.release as any)?.manifestActions === 'string'
      ? (projectGraphNode.data.release as any).manifestActions
      : typeof (releaseGroup as any).manifestActions === 'string'
      ? (releaseGroup as any).manifestActions
      : null;

  if (manifestActionsPathConfig) {
    const manifestActionsPath = resolveManifestActionsPath(
      manifestActionsPathConfig
    );
    const loaded = require(manifestActionsPath);
    const ManifestActionsClass = loaded.default ?? loaded;
    const manifestActions = new ManifestActionsClass(projectGraphNode);
    await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
    return {
      manifestActionsPath,
      ManifestActionsClass,
      manifestActions,
    };
  }

  // Otherwise, default to the JS implementation
  const manifestActionsPath = resolveManifestActionsPath(
    '@nx/js/src/generators/release-version/manifest-actions'
  );
  if (!JsManifestActions) {
    const loaded = require(manifestActionsPath);
    const ManifestActionsClass = loaded.default ?? loaded;
    JsManifestActions = ManifestActionsClass;
  }
  const manifestActions = new JsManifestActions(projectGraphNode);
  await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
  return {
    manifestActionsPath,
    ManifestActionsClass: JsManifestActions,
    manifestActions,
  };
}

export type ManifestData = {
  name: string;
  currentVersion: string;
  dependencies: Record<string, Record<string, string>>;
};

export abstract class ManifestActions {
  protected initialManifestData: ManifestData | null = null;

  constructor(protected projectGraphNode: ProjectGraphProjectNode) {}

  /**
   * Implementation details of performing any actions after all projects have been versioned.
   * An example might be updating a workspace level lock file.
   *
   * NOTE: By the time the returned callback is invoked, the tree will have been flushed back
   * to disk, so it is not accessible here.
   *
   * The callback should return lists of changed and deleted files so that they can be staged
   * and committed if appropriate.
   *
   * NOTE: The generatorOptions passed here are the ones at the root of release.version config,
   * different values per release group or project will not be respected here because this takes
   * place after all projects have been versioned.
   */
  static createAfterAllProjectsVersionedCallback(
    cwd: string,
    opts: {
      dryRun?: boolean;
      verbose?: boolean;
      generatorOptions?: Record<string, unknown>;
    }
  ): () => Promise<{
    changedFiles: string[];
    deletedFiles: string[];
  }> {
    return async () => ({
      changedFiles: [],
      deletedFiles: [],
    });
  }

  /**
   * Returns the primary manifest path for the project,
   * such as a package.json/Cargo.toml/etc.
   */
  abstract getPrimaryManifestPath(): string;

  /**
   * Implementation details of resolving a project's manifest file,
   * such as a package.json/Cargo.toml/etc, from disk.
   */
  abstract readManifestData(tree: Tree): Promise<ManifestData>;

  /**
   * Implementation details of resolving a project's current version from the manifest file.
   * Used as part of the current version resolver, and should throw if the version cannot be read
   * from the manifest file for whatever reason.
   */
  abstract readCurrentVersionFromManifest(tree: Tree): Promise<string>;

  /**
   * Implementation details of resolving a project's current version from a remote registry.
   * The specific logText will be combined with the generic remote registry log text and allows
   * the implementation to provide more specific information to the user about what registry URL
   * was used, what dist-tag etc.
   */
  abstract readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string;
    logText: string;
  }>;

  /**
   * Implementation details of writing a newly derived version to a project's
   * manifest file, such as a package.json/Cargo.toml/etc.
   */
  abstract writeVersionToManifest(
    tree: Tree,
    newVersion: string
  ): Promise<void>;

  /**
   * Implementation details of resolving the current version of a specific dependency from a project's manifest file.
   * The dependency collection is the type of dependency collection in the manifest file, such as 'dependencies',
   * 'devDependencies', 'peerDependencies', 'optionalDependencies', etc.
   */
  abstract getCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }>;

  /**
   * Implementation details of updating a project's manifest file,
   * such as a package.json/Cargo.toml/etc, with new dependency versions.
   */
  abstract updateDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<void>;

  /**
   * Implementation details of ensuring that the manifest file exists at the expected location,
   * will be invoked immediately after resolving the manifest actions for a particular project.
   */
  abstract ensureManifestExistsAtExpectedLocation(tree: Tree): Promise<void>;

  /**
   * Reads and caches the initial manifest data.
   */
  async getInitialManifestData(tree: Tree): Promise<ManifestData> {
    if (!this.initialManifestData) {
      this.initialManifestData = await this.readManifestData(tree);
    }
    return this.initialManifestData;
  }

  async determineSemverVersion(
    tree: Tree,
    bumpType: SemverBumpType
  ): Promise<string> {
    const manifestData = await this.getInitialManifestData(tree);
    // TODO: Support preid
    return deriveNewSemverVersion(manifestData.currentVersion, bumpType);
  }
}
