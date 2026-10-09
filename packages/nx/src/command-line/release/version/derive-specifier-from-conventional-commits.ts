import {
  coerce as semverCoerce,
  gt as semverGt,
  inc as semverInc,
  prerelease,
  type ReleaseType,
} from 'semver';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import {
  getFirstGitCommit,
  getFirstProjectCommit,
  getLatestGitTagForPattern,
  sanitizeProjectNameForGitTag,
} from '../utils/git';
import { ReleaseGraph } from '../utils/release-graph';
import { resolveSemverSpecifierFromConventionalCommits } from '../utils/resolve-semver-specifier';
import { SemverSpecifier, SemverSpecifierType } from '../utils/semver';
import { ProjectLogger } from './project-logger';
import { SemverBumpType } from './version-actions';

export async function deriveSpecifierFromConventionalCommits(
  nxReleaseConfig: NxReleaseConfig,
  projectGraph: ProjectGraph,
  projectLogger: ProjectLogger,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode,
  currentVersion: string,
  latestMatchingGitTag:
    | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
    | undefined,
  releaseGraph: ReleaseGraph,
  fallbackCurrentVersionResolver?: 'disk',
  preid?: string
): Promise<SemverBumpType> {
  const affectedProjects =
    releaseGroup.projectsRelationship === 'independent'
      ? [projectGraphNode.name]
      : releaseGroup.projects;

  // latestMatchingGitTag will be undefined if the current version was resolved from the disk fallback.
  // In this case, use the first commit that touched this project rather than the repo's first commit,
  // to avoid scanning the entire git history for projects that were added after the repo was created.
  const previousVersionRef = latestMatchingGitTag
    ? latestMatchingGitTag.tag
    : fallbackCurrentVersionResolver === 'disk'
      ? await getFirstProjectCommit(projectGraphNode.data.root)
      : undefined;

  if (!previousVersionRef) {
    // This should never happen since the checks above should catch if the current version couldn't be resolved
    throw new Error(
      `Unable to determine previous version ref for the projects ${affectedProjects.join(
        ', '
      )}. This is likely a bug in Nx.`
    );
  }

  const projectToSpecifiers =
    await resolveSemverSpecifierFromConventionalCommits(
      previousVersionRef,
      projectGraph,
      affectedProjects,
      nxReleaseConfig,
      releaseGraph,
      // Always match conventional-commit scopes against the full release
      // group, even when only a single (independent) project is being
      // processed, so genuine intra-group ambiguity is still detected.
      releaseGroup.projects
    );

  const getHighestSemverChange = (
    semverSpecifiersItr: MapIterator<SemverSpecifier>
  ) => {
    const semverSpecifiers = Array.from(semverSpecifiersItr);
    return semverSpecifiers.sort((a, b) => b - a)[0];
  };

  const semverSpecifier =
    releaseGroup.projectsRelationship === 'independent'
      ? projectToSpecifiers.get(projectGraphNode.name)
      : getHighestSemverChange(projectToSpecifiers.values());

  let specifier =
    semverSpecifier === null ? null : SemverSpecifierType[semverSpecifier];

  if (!specifier) {
    projectLogger.buffer(
      `🚫 No changes were detected using git history and the conventional commits standard`
    );
    return 'none';
  }

  // NOTE: This TODO was carried over from the original version generator.
  // TODO: reevaluate this prerelease logic/workflow for independent projects
  if (prerelease(currentVersion)) {
    // A prerelease version's base already encodes a severity relative to the
    // latest stable release (e.g. 2.2.0-rc.0 encodes a minor bump over 2.1.x).
    // Escalate to a higher base only when the derived severity exceeds it.
    const currentBaseVersion = semverCoerce(currentVersion)?.version;
    const latestStableVersion = currentBaseVersion
      ? (
          await getLatestGitTagForPattern(
            releaseGroup.releaseTag.pattern,
            {
              projectName: sanitizeProjectNameForGitTag(projectGraphNode.name),
              releaseGroupName: releaseGroup.name,
            },
            releaseGraph.resolveRepositoryTags.bind(releaseGraph),
            {
              checkAllBranchesWhen:
                releaseGroup.releaseTag.checkAllBranchesWhen,
              requireSemver: releaseGroup.releaseTag.requireSemver,
              strictPreid: true,
            }
          )
        )?.extractedVersion
      : undefined;
    const nextBaseVersion =
      latestStableVersion && currentBaseVersion
        ? semverInc(latestStableVersion, specifier as ReleaseType)
        : null;
    if (nextBaseVersion && semverGt(nextBaseVersion, currentBaseVersion)) {
      specifier = `pre${specifier}`;
      projectLogger.buffer(
        `📄 Resolved the specifier as "${specifier}" since the derived change severity exceeds the bump encoded by the current prerelease version`
      );
    } else {
      specifier = 'prerelease';
      projectLogger.buffer(
        `📄 Resolved the specifier as "${specifier}" since the current version is a prerelease`
      );
    }
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
