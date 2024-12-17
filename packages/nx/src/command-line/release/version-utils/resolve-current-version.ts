import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getLatestGitTagForPattern } from '../utils/git';
import { ReleaseVersionGeneratorSchema } from '../version';
import { ManifestActions } from './flexible-version-management';
import { ProjectLogger } from './project-logger';

export async function resolveCurrentVersion(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  releaseGroup: ReleaseGroupWithName,
  manifestActions: ManifestActions,
  logger: ProjectLogger,
  latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>
): Promise<string> {
  /**
   * The currentVersionResolver config can come from (in order of priority):
   * 1. An optional project level release config
   * 2. The project's releaseGroup (which will have been set appropriately  by the nx release config handler based on the global config)
   */
  let currentVersionResolver:
    | ReleaseVersionGeneratorSchema['currentVersionResolver']
    | undefined;
  let currentVersionResolverMetadata:
    | ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']
    | undefined;

  if (
    projectGraphNode.data.release?.version?.generatorOptions
      ?.currentVersionResolver
  ) {
    currentVersionResolver = projectGraphNode.data.release.version
      .generatorOptions
      .currentVersionResolver as ReleaseVersionGeneratorSchema['currentVersionResolver'];
    currentVersionResolverMetadata =
      (projectGraphNode.data.release.version.generatorOptions
        .currentVersionResolverMetadata as ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']) ??
      {};
  } else {
    currentVersionResolver = releaseGroup.version.generatorOptions
      .currentVersionResolver as ReleaseVersionGeneratorSchema['currentVersionResolver'];
    currentVersionResolverMetadata =
      (releaseGroup.version.generatorOptions
        .currentVersionResolverMetadata as ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']) ??
      {};
  }

  // TODO: Remove the temp fallback once we have moved currentVersionResolver to a direct property of the release group
  if (!currentVersionResolver) {
    currentVersionResolver = 'disk';
  }

  switch (currentVersionResolver) {
    // TODO: Implement registry resolver
    case 'registry': {
      return resolveCurrentVersionFromDisk(tree, manifestActions, logger);
    }
    case 'disk': {
      return resolveCurrentVersionFromDisk(tree, manifestActions, logger);
    }
    case 'git-tag': {
      return resolveCurrentVersionFromGitTag(
        tree,
        projectGraphNode,
        releaseGroup,
        manifestActions,
        logger,
        latestMatchingGitTag
      );
    }
    default:
      throw new Error(
        `Invalid value for "currentVersionResolver": ${currentVersionResolver}`
      );
  }
}

export async function resolveCurrentVersionFromDisk(
  tree: Tree,
  manifestActions: ManifestActions,
  logger: ProjectLogger
): Promise<string> {
  const currentVersion = await manifestActions.resolveCurrentVersion(tree);
  const manifestPath = manifestActions.getPrimaryManifestPath();
  logger.buffer(
    `📄 Resolved the current version as ${currentVersion} from manifest: ${manifestPath}`
  );
  return currentVersion;
}

export async function resolveCurrentVersionFromGitTag(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  releaseGroup: ReleaseGroupWithName,
  manifestActions: ManifestActions,
  logger: ProjectLogger,
  latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>
): Promise<string> {
  if (!latestMatchingGitTag) {
    if (
      releaseGroup.version.generatorOptions.fallbackCurrentVersionResolver ===
      'disk'
    ) {
      return resolveCurrentVersionFromDisk(tree, manifestActions, logger);
    } else {
      throw new Error(
        `No git tags matching pattern "${releaseGroup.releaseTagPattern}" for project "${projectGraphNode.name}" were found. You will need to create an initial matching tag to use as a base for determining the next version. Alternatively, you can use the --first-release option or set "release.version.generatorOptions.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when no matching git tags are found.`
      );
    }
  }

  const currentVersion = latestMatchingGitTag.extractedVersion;
  logger.buffer(
    `📄 Resolved the current version as ${currentVersion} from git tag "${latestMatchingGitTag.tag}".`
  );
  return currentVersion;
}
