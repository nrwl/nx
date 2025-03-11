import chalk = require('chalk');
import { prompt } from 'enquirer';
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
  firstRelease: boolean,
  cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  >,
  specifierSource: ReleaseVersionGeneratorSchema['specifierSource'],
  releaseTagPattern: string,
  latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>,
  fallbackCurrentVersionResolver?: ReleaseVersionGeneratorSchema['fallbackCurrentVersionResolver']
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

  if (firstRelease) {
    // Always use disk as a fallback for the first release
    fallbackCurrentVersionResolver = 'disk';
  }

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
    case 'disk': {
      return resolveCurrentVersionFromDisk(tree, manifestActions, logger);
    }
    case 'registry': {
      return resolveCurrentVersionFromRegistry(
        tree,
        projectGraphNode,
        releaseGroup,
        manifestActions,
        logger,
        cachedCurrentVersionsPerFixedReleaseGroup,
        specifierSource,
        fallbackCurrentVersionResolver,
        currentVersionResolverMetadata
      );
    }
    case 'git-tag': {
      return resolveCurrentVersionFromGitTag(
        tree,
        projectGraphNode,
        releaseGroup,
        manifestActions,
        logger,
        cachedCurrentVersionsPerFixedReleaseGroup,
        specifierSource,
        fallbackCurrentVersionResolver,
        releaseTagPattern,
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
  const currentVersion =
    await manifestActions.readCurrentVersionFromSourceManifest(tree);
  const sourceManifestPath = manifestActions.getSourceManifestPath();
  logger.buffer(
    `📄 Resolved the current version as ${currentVersion} from manifest: ${sourceManifestPath}`
  );
  return currentVersion;
}

export async function resolveCurrentVersionFromRegistry(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  releaseGroup: ReleaseGroupWithName,
  manifestActions: ManifestActions,
  logger: ProjectLogger,
  cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText?: string;
    }
  >,
  specifierSource: ReleaseVersionGeneratorSchema['specifierSource'],
  fallbackCurrentVersionResolver: ReleaseVersionGeneratorSchema['fallbackCurrentVersionResolver'],
  currentVersionResolverMetadata: ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']
): Promise<string> {
  /**
   * In the case of fixed release groups that are configured to resolve the current version from a registry,
   * it would be a waste of time and resources to make requests to the registry, or resolve one of the fallbacks,
   * for each individual project, therefore we maintain a cache of the current version for each applicable release group here.
   */
  const cached = cachedCurrentVersionsPerFixedReleaseGroup.get(
    releaseGroup.name
  );
  if (cached) {
    const logText = cached.logText ? ` ${cached.logText}` : '';
    logger.buffer(
      `♻️  Reusing the current version ${cached.currentVersion} already resolved for ${cached.originatingProjectName}${logText}`
    );
    return cached.currentVersion;
  }

  let registryTxt = '';
  try {
    // TODO: add spinner here
    const { currentVersion, logText } =
      await manifestActions.readCurrentVersionFromRegistry(
        tree,
        currentVersionResolverMetadata
      );
    registryTxt = logText?.length > 0 ? `: ${logText}` : '';
    if (!currentVersion) {
      throw new Error('No version found in the registry');
    }
    logger.buffer(
      `🔍 Resolved the current version as ${currentVersion} from the remote registry${registryTxt}`
    );
    // Write to the cache if the release group is fixed
    if (releaseGroup.projectsRelationship === 'fixed') {
      cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
        currentVersion,
        originatingProjectName: projectGraphNode.name,
        logText: `from the registry${registryTxt}`,
      });
    }
    return currentVersion;
  } catch {
    if (fallbackCurrentVersionResolver === 'disk') {
      const currentVersionFromDisk =
        await manifestActions.readCurrentVersionFromSourceManifest(tree);
      // Fallback on disk is available, return it directly
      if (currentVersionFromDisk) {
        logger.buffer(
          `⚠️  Unable to resolve the current version from the registry${registryTxt}. Falling back to the version ${currentVersionFromDisk} in manifest: ${manifestActions.getSourceManifestPath()}`
        );
        // Write to the cache if the release group is fixed
        if (releaseGroup.projectsRelationship === 'fixed') {
          cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
            currentVersion: currentVersionFromDisk,
            originatingProjectName: projectGraphNode.name,
            logText: `from the disk fallback`,
          });
        }
        return currentVersionFromDisk;
      }
    }

    // At this point the fallback on disk is also not available/configured, allow one final interactive fallback, but only when using version-plans or conventional-commits
    if (specifierSource === 'prompt') {
      throw new Error(
        `Unable to resolve the current version from the registry${registryTxt}. Please ensure that the package exists in the registry in order to use the "registry" currentVersionResolver. Alternatively, you can use the --first-release option or set "release.version.generatorOptions.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when the registry lookup fails.`
      );
    }
    const currentVersionFromPromptFallback =
      await handleNoAvailableDiskFallback({
        logger,
        projectName: projectGraphNode.name,
        manifestActions,
        specifierSource,
        currentVersionSourceMessage: `from the registry${registryTxt}`,
        resolutionSuggestion: `you should publish an initial version to the registry`,
      });
    // Write to the cache if the release group is fixed
    if (releaseGroup.projectsRelationship === 'fixed') {
      cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
        currentVersion: currentVersionFromPromptFallback,
        originatingProjectName: projectGraphNode.name,
        logText: `from the prompt fallback`,
      });
    }
    return currentVersionFromPromptFallback;
  }
}

export async function resolveCurrentVersionFromGitTag(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  releaseGroup: ReleaseGroupWithName,
  manifestActions: ManifestActions,
  logger: ProjectLogger,
  cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  >,
  specifierSource: ReleaseVersionGeneratorSchema['specifierSource'],
  fallbackCurrentVersionResolver: ReleaseVersionGeneratorSchema['fallbackCurrentVersionResolver'],
  releaseTagPattern: string,
  latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>
): Promise<string> {
  /**
   * In the case of fixed release groups that are configured to resolve the current version from a git tag,
   * it would be a waste of time and resources to figure out the git tag, or resolve one of the fallbacks,
   * for each individual project, therefore we maintain a cache of the current version for each applicable release group here.
   */
  const cached = cachedCurrentVersionsPerFixedReleaseGroup.get(
    releaseGroup.name
  );
  if (cached) {
    const logText = cached.logText ? ` ${cached.logText}` : '';
    logger.buffer(
      `♻️  Reusing the current version ${cached.currentVersion} already resolved for ${cached.originatingProjectName}${logText}`
    );
    return cached.currentVersion;
  }

  // The latest matching git tag was found in release-group-processor and has an extracted version, return it directly
  if (latestMatchingGitTag && latestMatchingGitTag.extractedVersion) {
    const currentVersion = latestMatchingGitTag.extractedVersion;
    logger.buffer(
      `🏷️  Resolved the current version as ${currentVersion} from git tag "${latestMatchingGitTag.tag}".`
    );
    // Write to the cache if the release group is fixed
    if (releaseGroup.projectsRelationship === 'fixed') {
      cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
        currentVersion,
        originatingProjectName: projectGraphNode.name,
        logText: `from git tag "${latestMatchingGitTag.tag}"`,
      });
    }
    return currentVersion;
  }

  const noMatchingGitTagsError = new Error(
    `No git tags matching pattern "${releaseGroup.releaseTagPattern}" for project "${projectGraphNode.name}" were found. You will need to create an initial matching tag to use as a base for determining the next version. Alternatively, you can use the --first-release option or set "release.version.generatorOptions.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when no matching git tags are found.`
  );
  if (fallbackCurrentVersionResolver !== 'disk') {
    throw noMatchingGitTagsError;
  }

  const currentVersionFromDisk =
    await manifestActions.readCurrentVersionFromSourceManifest(tree);
  // Fallback on disk is available, return it directly
  if (currentVersionFromDisk) {
    logger.buffer(
      `⚠️  Unable to resolve the current version from git tags using pattern "${releaseTagPattern}". Falling back to the version ${currentVersionFromDisk} in manifest: ${manifestActions.getSourceManifestPath()}`
    );
    // Write to the cache if the release group is fixed
    if (releaseGroup.projectsRelationship === 'fixed') {
      cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
        currentVersion: currentVersionFromDisk,
        originatingProjectName: projectGraphNode.name,
        logText: `from the disk fallback`,
      });
    }
    return currentVersionFromDisk;
  }

  // At this point the fallback on disk is also not available/configured, allow one final interactive fallback, but only when using version-plans or conventional-commits
  if (specifierSource === 'prompt') {
    throw noMatchingGitTagsError;
  }
  const currentVersionFromPromptFallback = await handleNoAvailableDiskFallback({
    logger,
    projectName: projectGraphNode.name,
    manifestActions,
    specifierSource,
    currentVersionSourceMessage: `from git tag using pattern "${releaseTagPattern}"`,
    resolutionSuggestion: `you should set an initial git tag on a relevant commit`,
  });
  // Write to the cache if the release group is fixed
  if (releaseGroup.projectsRelationship === 'fixed') {
    cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
      currentVersion: currentVersionFromPromptFallback,
      originatingProjectName: projectGraphNode.name,
      logText: `from the prompt fallback`,
    });
  }
  return currentVersionFromPromptFallback;
}

/**
 * Allow users to be unblocked when locally running releases for the very first time with certain combinations that require an initial
 * version in order to function (e.g. a relative semver bump derived via conventional-commits or version-plans) by providing an interactive
 * prompt to let them opt into using 0.0.0 as the implied current version.
 */
async function handleNoAvailableDiskFallback({
  logger,
  projectName,
  manifestActions,
  specifierSource,
  currentVersionSourceMessage,
  resolutionSuggestion,
}: {
  logger: ProjectLogger;
  projectName: string;
  manifestActions: ManifestActions;
  specifierSource: Exclude<
    ReleaseVersionGeneratorSchema['specifierSource'],
    'prompt'
  >;
  currentVersionSourceMessage: string;
  resolutionSuggestion: string;
}): Promise<string> {
  const sourceManifestPath = manifestActions.getSourceManifestPath();

  const unresolvableCurrentVersionError = new Error(
    `Unable to resolve the current version ${currentVersionSourceMessage} and there is no version on disk to fall back to. This is invalid with ${specifierSource} because the new version is determined by relatively bumping the current version. To resolve this, ${resolutionSuggestion}, or set an appropriate value for "version" in ${sourceManifestPath}`
  );
  if (process.env.CI === 'true') {
    // We can't prompt in CI, so error immediately
    throw unresolvableCurrentVersionError;
  }
  try {
    const reply = await prompt<{ useZero: boolean }>([
      {
        name: 'useZero',
        message: `\n${chalk.yellow(
          `Warning: Unable to resolve the current version for "${projectName}" ${currentVersionSourceMessage} and there is no version on disk to fall back to. This is invalid with ${specifierSource} because the new version is determined by relatively bumping the current version.\n\nTo resolve this, ${resolutionSuggestion}, or set an appropriate value for "version" in ${sourceManifestPath}`
        )}. \n\nAlternatively, would you like to continue now by using 0.0.0 as the current version?`,
        type: 'confirm',
        initial: false,
      },
    ]);
    if (!reply.useZero) {
      // Throw any error to skip the fallback to 0.0.0, may as well use the one we already have
      throw unresolvableCurrentVersionError;
    }
    const currentVersion = '0.0.0';
    logger.buffer(
      `⚠  Forcibly resolved the current version as "${currentVersion}" based on your response to the prompt above.`
    );
    return currentVersion;
  } catch {
    throw unresolvableCurrentVersionError;
  }
}
