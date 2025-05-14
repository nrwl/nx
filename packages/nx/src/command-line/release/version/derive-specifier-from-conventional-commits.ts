import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getFirstGitCommit, getLatestGitTagForPattern } from '../utils/git';
import { resolveSemverSpecifierFromConventionalCommits } from '../utils/resolve-semver-specifier';
import { ProjectLogger } from './project-logger';
import { SemverBumpType } from './version-actions';

export async function deriveSpecifierFromConventionalCommits(
  nxReleaseConfig: NxReleaseConfig,
  projectGraph: ProjectGraph,
  projectLogger: ProjectLogger,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode,
  // NOTE: This TODO was carried over from the original version generator.
  //
  // TODO: reevaluate this prerelease logic/workflow for independent projects
  // Always assume that if the current version is a prerelease, then the next version should be a prerelease.
  // Users must manually graduate from a prerelease to a release by providing an explicit specifier.
  isPrerelease: boolean,
  latestMatchingGitTag:
    | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
    | undefined,
  fallbackCurrentVersionResolver?: 'disk',
  preid?: string
): Promise<SemverBumpType> {
  const affectedProjects =
    releaseGroup.projectsRelationship === 'independent'
      ? [projectGraphNode.name]
      : releaseGroup.projects;

  // latestMatchingGitTag will be undefined if the current version was resolved from the disk fallback.
  // In this case, we want to use the first commit as the ref to be consistent with the changelog command.
  const previousVersionRef = latestMatchingGitTag
    ? latestMatchingGitTag.tag
    : fallbackCurrentVersionResolver === 'disk'
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
    projectLogger.buffer(
      `🚫 No changes were detected using git history and the conventional commits standard`
    );
    return 'none';
  }

  // NOTE: This TODO was carried over from the original version generator.
  // TODO: reevaluate this prerelease logic/workflow for independent projects
  if (isPrerelease) {
    specifier = 'prerelease';
    projectLogger.buffer(
      `📄 Resolved the specifier as "${specifier}" since the current version is a prerelease`
    );
  } else {
    let extraText = '';
    if (preid && !specifier.startsWith('pre')) {
      specifier = `pre${specifier}`;
      extraText = `, combined with your given preid "${preid}"`;
    }
    projectLogger.buffer(
      `📄 Resolved the specifier as "${specifier}" using git history and the conventional commits standard${extraText}`
    );
  }

  return specifier as SemverBumpType;
}
