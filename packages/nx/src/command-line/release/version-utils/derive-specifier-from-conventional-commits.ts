import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getFirstGitCommit, getLatestGitTagForPattern } from '../utils/git';
import { resolveSemverSpecifierFromConventionalCommits } from '../utils/resolve-semver-specifier';
import { SemverBumpType } from './flexible-version-management';
import { ProjectLogger } from './project-logger';

export async function deriveSpecifierFromConventionalCommits(
  nxReleaseConfig: NxReleaseConfig,
  projectGraph: ProjectGraph,
  logger: ProjectLogger,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode,
  // TODO: reevaluate this prerelease logic/workflow for independent projects
  // Always assume that if the current version is a prerelease, then the next version should be a prerelease.
  // Users must manually graduate from a prerelease to a release by providing an explicit specifier.
  isPrerelease: boolean,
  latestMatchingGitTag:
    | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
    | undefined,
  preid?: string
): Promise<SemverBumpType> {
  // TODO: Move this validation up a level?
  const currentVersionResolver =
    projectGraphNode.data.release?.version?.generatorOptions
      ?.currentVersionResolver ||
    releaseGroup.version.generatorOptions?.currentVersionResolver;
  if (currentVersionResolver !== 'git-tag') {
    throw new Error(
      `Invalid currentVersionResolver "${currentVersionResolver}" provided for project "${projectGraphNode.name}". Must be "git-tag" when "specifierSource" is "conventional-commits"`
    );
  }

  const affectedProjects =
    releaseGroup.projectsRelationship === 'independent'
      ? [projectGraphNode.name]
      : releaseGroup.projects;
  // TODO: Confirm we don't want to populate project nodes on release groups like we seemingly did before?
  // : releaseGroup.projects.map((p) => p.name);

  // latestMatchingGitTag will be undefined if the current version was resolved from the disk fallback.
  // In this case, we want to use the first commit as the ref to be consistent with the changelog command.
  const previousVersionRef = latestMatchingGitTag
    ? latestMatchingGitTag.tag
    : releaseGroup.version.generatorOptions.fallbackCurrentVersionResolver ===
      'disk'
    ? await getFirstGitCommit()
    : undefined;

  if (!previousVersionRef) {
    // This should never happen since the checks above should catch if the current version couldn't be resolved
    throw new Error(
      `Unable to determine previous version ref for the projects ${affectedProjects.join(
        ', '
      )}. This is likely a bug in Nx.`
    );
  }

  let specifier = await resolveSemverSpecifierFromConventionalCommits(
    previousVersionRef,
    projectGraph,
    affectedProjects,
    nxReleaseConfig.conventionalCommits
  );

  if (!specifier) {
    // TODO: Equivalent logging for this case
    // if (
    //   releaseGroup.version.generatorOptions.updateDependents !== 'never' &&
    //   projectToDependencyBumps.has(projectName)
    // ) {
    //   // No applicable changes to the project directly by the user, but one or more dependencies have been bumped and updateDependents is enabled
    //   specifier = updateDependentsBump;
    //   logger.buffer(
    //     `📄 Resolved the specifier as "${specifier}" because "release.version.generatorOptions.updateDependents" is enabled`
    //   );
    //   return 'none';
    // }
    logger.buffer(
      `🚫 No changes were detected using git history and the conventional commits standard.`
    );
    return 'none';
  }

  // TODO: reevaluate this prerelease logic/workflow for independent projects
  if (isPrerelease) {
    specifier = 'prerelease';
    logger.buffer(
      `📄 Resolved the specifier as "${specifier}" since the current version is a prerelease.`
    );
  } else {
    let extraText = '';
    if (preid && !specifier.startsWith('pre')) {
      specifier = `pre${specifier}`;
      extraText = `, combined with your given preid "${preid}"`;
    }
    logger.buffer(
      `📄 Resolved the specifier as "${specifier}" using git history and the conventional commits standard${extraText}.`
    );
  }

  return specifier as SemverBumpType;
}
