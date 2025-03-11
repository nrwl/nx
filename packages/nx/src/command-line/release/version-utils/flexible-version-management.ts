import { dirname, join } from 'node:path';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { interpolate } from '../../../tasks-runner/utils';
import { workspaceRoot } from '../../../utils/workspace-root';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { ReleaseVersionGeneratorSchema } from '../version';

export type SpecifierSource =
  | 'prompt'
  | 'conventional-commits'
  | 'version-plans';
export type SemverBumpType = 'major' | 'minor' | 'patch' | 'none';
export type SideEffectBumpType = SemverBumpType;

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
  projectGraphNode: ProjectGraphProjectNode,
  manifestRootsToUpdate: string[]
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
    const manifestActions: ManifestActions = new ManifestActionsClass(
      releaseGroup,
      projectGraphNode,
      manifestRootsToUpdate
    );
    await manifestActions.ensureSourceManifestExistsAtExpectedLocation(tree);
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
  const manifestActions: ManifestActions = new JsManifestActions(
    releaseGroup,
    projectGraphNode,
    manifestRootsToUpdate
  );
  await manifestActions.ensureSourceManifestExistsAtExpectedLocation(tree);
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
  /**
   * The filename of the manifest file, such as package.json/Cargo.toml/etc.
   */
  abstract manifestFilename: string;
  /**
   * The interpolated manifest paths to update when new versions and dependencies are written.
   */
  manifestsToUpdate: string[] = [];
  protected sourceManifestData: ManifestData | null = null;

  constructor(
    public releaseGroup: ReleaseGroupWithName,
    public projectGraphNode: ProjectGraphProjectNode,
    private manifestRootsToUpdate: string[]
  ) {}

  async init(tree: Tree): Promise<void> {
    // Default to the source manifest root if no custom manifest roots are provided
    if (this.manifestRootsToUpdate.length === 0) {
      this.manifestRootsToUpdate.push(dirname(this.getSourceManifestPath()));
    }

    // Create a final collection of interpolated manifest paths to update when new versions and dependencies are written
    this.manifestsToUpdate = this.manifestRootsToUpdate.map((manifestRoot) => {
      const interpolatedManifestRoot = interpolate(manifestRoot, {
        workspaceRoot: '',
        projectRoot: this.projectGraphNode.data.root,
        projectName: this.projectGraphNode.name,
      });
      return join(interpolatedManifestRoot, this.manifestFilename);
    });

    // Populate the source manifest data cache up front
    await this.readCachedSourceManifestData(tree);
  }

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
   * Implementation details of ensuring that the source manifest file exists at the expected location,
   * will be invoked immediately after resolving the manifest actions for a particular project.
   */
  abstract ensureSourceManifestExistsAtExpectedLocation(
    tree: Tree
  ): Promise<void>;

  /**
   * Returns the default source manifest path (the standard manifest filename at the project root).
   */
  getSourceManifestPath(): string {
    return join(this.projectGraphNode.data.root, this.manifestFilename);
  }

  /**
   * Reads and caches the initial manifest data. This can be used when evaluating dependency relationships,
   * but cannot be used for tree updates because it would get out of sync with the actual manifest data in
   * the tree.
   */
  async readCachedSourceManifestData(tree: Tree): Promise<ManifestData> {
    if (!this.sourceManifestData) {
      this.sourceManifestData = await this.readSourceManifestData(tree);
    }
    return this.sourceManifestData;
  }

  /**
   * Implementation details of resolving a project's manifest file,
   * such as a package.json/Cargo.toml/etc, from disk.
   */
  abstract readSourceManifestData(tree: Tree): Promise<ManifestData>;

  /**
   * Implementation details of resolving a project's current version from its source manifest file.
   * Used as part of the current version resolver, and should throw if the version cannot be read
   * from the manifest file for whatever reason.
   */
  abstract readCurrentVersionFromSourceManifest(tree: Tree): Promise<string>;

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
   * Implementation details of resolving the current version of a specific dependency from a project's source manifest file.
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
   * Implementation details of writing a newly derived version to a project's
   * manifest file, or multiple manifest files (e.g. src and dist), such as a
   * package.json/Cargo.toml/etc.
   */
  abstract writeVersionToManifests(
    tree: Tree,
    newVersion: string
  ): Promise<void>;

  /**
   * Implementation details of updating a project's manifest file,
   * or multiple manifest files (e.g. src and dist), such as a
   * package.json/Cargo.toml/etc, with new dependency versions.
   */
  abstract updateDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<void>;
}
