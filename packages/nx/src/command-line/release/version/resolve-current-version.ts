import chalk = require('chalk');
import * as ora from 'ora';
import { prompt } from 'enquirer';
import { NxReleaseVersionConfiguration } from '../../../config/nx-json';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getLatestGitTagForPattern } from '../utils/git';
import { ProjectLogger } from './project-logger';
import type { FinalConfigForProject } from './release-group-processor';
import { VersionActions } from './version-actions';

export async function resolveCurrentVersion(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  releaseGroup: ReleaseGroupWithName,
  versionActions: VersionActions,
  logger: ProjectLogger,
  cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  >,
  finalConfigForProject: FinalConfigForProject,
  releaseTagPattern: string,
  latestMatchingGitTag?: Awaited<ReturnType<typeof getLatestGitTagForPattern>>
): Promise<string | null> {
  switch (finalConfigForProject.currentVersionResolver) {
    case 'none':
      return null;
    case 'disk': {
      return resolveCurrentVersionFromDisk(
        tree,
        projectGraphNode,
        versionActions,
        logger
      );
    }
    case 'registry': {
      return resolveCurrentVersionFromRegistry(
        tree,
        projectGraphNode,
        releaseGroup,
        versionActions,
        logger,
        cachedCurrentVersionsPerFixedReleaseGroup,
        finalConfigForProject
      );
    }
    case 'git-tag': {
      return resolveCurrentVersionFromGitTag(
        tree,
        projectGraphNode,
        releaseGroup,
        versionActions,
        logger,
        cachedCurrentVersionsPerFixedReleaseGroup,
        finalConfigForProject,
        releaseTagPattern,
        latestMatchingGitTag
      );
    }
    default:
      throw new Error(
        `Invalid value for "currentVersionResolver": ${finalConfigForProject.currentVersionResolver}`
      );
  }
}

/**
 * Attempt to resolve the current version from the manifest file on disk.
 *
 * Not all VersionActions implementations support a manifest file, in which case the logic will handle either thrown errors
 * or null values being returned from the readCurrentVersionFromSourceManifest method and throw a clear user-facing error.
 */
export async function resolveCurrentVersionFromDisk(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  versionActions: VersionActions,
  logger: ProjectLogger
): Promise<string> {
  if (!versionActions.validManifestFilenames?.length) {
    throw new Error(
      `For project "${projectGraphNode.name}", the "currentVersionResolver" is set to "disk" but it is using "versionActions" of type "${versionActions.constructor.name}". This is invalid because "${versionActions.constructor.name}" does not support a manifest file. You should use a different "currentVersionResolver" or use a different "versionActions" implementation that supports a manifest file`
    );
  }
  const nullVersionError = new Error(
    `For project "${projectGraphNode.name}", the "currentVersionResolver" is set to "disk" and it is using "versionActions" of type "${versionActions.constructor.name}" which failed to resolve the current version from the manifest file on disk`
  );
  try {
    const res = await versionActions.readCurrentVersionFromSourceManifest(tree);
    if (!res) {
      throw nullVersionError;
    }
    const { currentVersion, manifestPath } = res;
    logger.buffer(
      `📄 Resolved the current version as ${currentVersion} from manifest: ${manifestPath}`
    );
    return currentVersion;
  } catch (err) {
    if (err === nullVersionError) {
      throw err;
    }
    throw new Error(
      `The project "${
        projectGraphNode.name
      }" does not have a ${versionActions.validManifestFilenames.join(
        ' or '
      )} file available in ./${projectGraphNode.data.root}.

To fix this you will either need to add a ${versionActions.validManifestFilenames.join(
        ' or '
      )} file at that location, or configure "release" within your nx.json to use a different "currentVersionResolver" or "versionActions" implementation that supports this setup`
    );
  }
}

export async function resolveCurrentVersionFromRegistry(
  tree: Tree,
  projectGraphNode: ProjectGraphProjectNode,
  releaseGroup: ReleaseGroupWithName,
  versionActions: VersionActions,
  logger: ProjectLogger,
  cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText?: string;
    }
  >,
  finalConfigForProject: FinalConfigForProject
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
      `🔄 Reusing the current version ${cached.currentVersion} already resolved for ${cached.originatingProjectName}${logText}`
    );
    return cached.currentVersion;
  }

  let registryTxt = '';

  const spinner = ora(
    `Resolving the current version for ${projectGraphNode.name} from the configured registry...`
  );
  spinner.color = 'cyan';
  spinner.start();

  try {
    const res = await versionActions.readCurrentVersionFromRegistry(
      tree,
      finalConfigForProject.currentVersionResolverMetadata
    );
    if (!res) {
      // Not a user-facing error
      throw new Error(
        'Registry not applicable for this version actions implementation'
      );
    }
    const { currentVersion, logText } = res;
    spinner.stop();

    registryTxt = logText?.length > 0 ? `: ${logText}` : '';
    if (!currentVersion) {
      // Not a user-facing error
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
    spinner.stop();

    if (finalConfigForProject.fallbackCurrentVersionResolver === 'disk') {
      if (!versionActions.validManifestFilenames?.length) {
        throw new Error(
          `For project "${projectGraphNode.name}", the "currentVersionResolver" is set to "registry" with a "fallbackCurrentVersionResolver" of "disk" but it is using "versionActions" of type "${versionActions.constructor.name}". This is invalid because "${versionActions.constructor.name}" does not support a manifest file. You should use a different "fallbackCurrentVersionResolver" or use a different "versionActions" implementation that supports a manifest file`
        );
      }

      const fromDiskRes =
        await versionActions.readCurrentVersionFromSourceManifest(tree);
      // Fallback on disk is available, return it directly
      if (fromDiskRes && fromDiskRes.currentVersion) {
        logger.buffer(
          `⚠️  Unable to resolve the current version from the registry${registryTxt}. Falling back to the version ${fromDiskRes.currentVersion} in manifest: ${fromDiskRes.manifestPath}`
        );
        // Write to the cache if the release group is fixed
        if (releaseGroup.projectsRelationship === 'fixed') {
          cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
            currentVersion: fromDiskRes.currentVersion,
            originatingProjectName: projectGraphNode.name,
            logText: `from the disk fallback`,
          });
        }
        return fromDiskRes.currentVersion;
      }
    }

    // At this point the fallback on disk is also not available/configured, allow one final interactive fallback, but only when using version-plans or conventional-commits
    if (finalConfigForProject.specifierSource === 'prompt') {
      throw new Error(
        `Unable to resolve the current version from the registry${registryTxt}. Please ensure that the package exists in the registry in order to use the "registry" currentVersionResolver. Alternatively, you can use the --first-release option or set "release.version.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when the registry lookup fails.`
      );
    }
    const currentVersionFromPromptFallback =
      await handleNoAvailableDiskFallback({
        logger,
        projectName: projectGraphNode.name,
        versionActions,
        specifierSource: finalConfigForProject.specifierSource,
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
  versionActions: VersionActions,
  logger: ProjectLogger,
  cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  >,
  finalConfigForProject: FinalConfigForProject,
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
      `🔄 Reusing the current version ${cached.currentVersion} already resolved for ${cached.originatingProjectName}${logText}`
    );
    return cached.currentVersion;
  }

  // The latest matching git tag was found in release-group-processor and has an extracted version, return it directly
  if (latestMatchingGitTag && latestMatchingGitTag.extractedVersion) {
    const currentVersion = latestMatchingGitTag.extractedVersion;
    logger.buffer(
      `🏷️  Resolved the current version as ${currentVersion} from git tag "${latestMatchingGitTag.tag}", based on releaseTagPattern "${releaseTagPattern}"`
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
    `No git tags matching pattern "${releaseTagPattern}" for project "${projectGraphNode.name}" were found. You will need to create an initial matching tag to use as a base for determining the next version. Alternatively, you can use the --first-release option or set "release.version.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when no matching git tags are found.`
  );
  if (finalConfigForProject.fallbackCurrentVersionResolver !== 'disk') {
    throw noMatchingGitTagsError;
  }

  const fromDiskRes = await versionActions.readCurrentVersionFromSourceManifest(
    tree
  );
  // Fallback on disk is available, return it directly
  if (fromDiskRes && fromDiskRes.currentVersion) {
    logger.buffer(
      `⚠️  Unable to resolve the current version from git tags using pattern "${releaseTagPattern}". Falling back to the version ${fromDiskRes.currentVersion} in manifest: ${fromDiskRes.manifestPath}`
    );
    // Write to the cache if the release group is fixed
    if (releaseGroup.projectsRelationship === 'fixed') {
      cachedCurrentVersionsPerFixedReleaseGroup.set(releaseGroup.name, {
        currentVersion: fromDiskRes.currentVersion,
        originatingProjectName: projectGraphNode.name,
        logText: `from the disk fallback`,
      });
    }
    return fromDiskRes.currentVersion;
  }

  // At this point the fallback on disk is also not available/configured, allow one final interactive fallback, but only when using version-plans or conventional-commits
  if (finalConfigForProject.specifierSource === 'prompt') {
    throw noMatchingGitTagsError;
  }
  const currentVersionFromPromptFallback = await handleNoAvailableDiskFallback({
    logger,
    projectName: projectGraphNode.name,
    versionActions,
    specifierSource: finalConfigForProject.specifierSource,
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
  versionActions,
  specifierSource,
  currentVersionSourceMessage,
  resolutionSuggestion,
}: {
  logger: ProjectLogger;
  projectName: string;
  versionActions: VersionActions;
  specifierSource: Exclude<
    NxReleaseVersionConfiguration['specifierSource'],
    'prompt'
  >;
  currentVersionSourceMessage: string;
  resolutionSuggestion: string;
}): Promise<string> {
  if (!versionActions.validManifestFilenames?.length) {
    throw new Error(
      `Unable to resolve the current version ${currentVersionSourceMessage} and there is no version on disk to fall back to. This is invalid with ${specifierSource} because the new version is determined by relatively bumping the current version. To resolve this, ${resolutionSuggestion}, or set use a versionActions implementation that supports a manifest file`
    );
  }

  const validManifestFilenames =
    versionActions.validManifestFilenames.join(' or ');

  const unresolvableCurrentVersionError = new Error(
    `Unable to resolve the current version ${currentVersionSourceMessage} and there is no version on disk to fall back to. This is invalid with ${specifierSource} because the new version is determined by relatively bumping the current version. To resolve this, ${resolutionSuggestion}, or set an appropriate version in a supported manifest file such as ${validManifestFilenames}`
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
          `Warning: Unable to resolve the current version for "${projectName}" ${currentVersionSourceMessage} and there is no version on disk to fall back to. This is invalid with ${specifierSource} because the new version is determined by relatively bumping the current version.\n\nTo resolve this, ${resolutionSuggestion}, or set an appropriate version in a supported manifest file such as ${validManifestFilenames}`
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
      `⚠  Forcibly resolved the current version as "${currentVersion}" based on your response to the prompt above`
    );
    return currentVersion;
  } catch {
    throw unresolvableCurrentVersionError;
  }
}
