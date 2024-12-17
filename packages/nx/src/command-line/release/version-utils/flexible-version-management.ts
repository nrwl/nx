import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { deriveNewSemverVersion } from '../utils/semver';

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

let JsManifestActions;

export async function resolveManifestActionsForProject(
  tree: Tree,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode
): Promise<ManifestActions> {
  // Project level "release" config takes priority
  // TODO: Update release config type to include manifestActions
  if (
    typeof (projectGraphNode.data.release as any)?.manifestActions === 'string'
  ) {
    const ManifestActionsClass = require((projectGraphNode.data.release as any)
      .manifestActions);
    const manifestActions = new ManifestActionsClass(projectGraphNode);
    await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
    return manifestActions;
  }

  // Then release group level
  if (typeof (releaseGroup as any).manifestActions === 'string') {
    const ManifestActionsClass = require((releaseGroup as any).manifestActions);
    const manifestActions = new ManifestActionsClass(projectGraphNode);
    await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
    return manifestActions;
  }

  // Otherwise, default to the JS implementation
  if (!JsManifestActions) {
    // TODO: This string should probably be applied in config.ts like with other things, so that it's always set if needed,
    // although we still want to preserve some caching when we do that
    const ManifestActionsClass =
      // nx-ignore-next-line
      require('@nx/js/src/generators/release-version/manifest-actions').default;
    JsManifestActions = ManifestActionsClass;
  }
  const manifestActions = new JsManifestActions(projectGraphNode);
  await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
  return manifestActions;
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
  abstract resolveCurrentVersion(tree: Tree): Promise<string>;

  /**
   * Implementation details of writing a newly derived version to a project's
   * manifest file, such as a package.json/Cargo.toml/etc.
   */
  abstract writeVersionToManifest(
    tree: Tree,
    newVersion: string
  ): Promise<void>;

  /**
   * Implementation details of updating a project's manifest file,
   * such as a package.json/Cargo.toml/etc, with new dependency versions.
   */
  abstract updateDependencies(
    tree: Tree,
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
