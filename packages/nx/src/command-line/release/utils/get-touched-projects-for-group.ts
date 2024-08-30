import { FileData, ProjectGraph } from '../../../config/project-graph';
import { getTouchedProjects } from '../../../project-graph/affected/locators/workspace-projects';
import { calculateFileChanges } from '../../../project-graph/file-utils';
import { NxArgs } from '../../../utils/command-line-utils';
import { getIgnoreObject } from '../../../utils/ignore';
import { output } from '../../../utils/output';
import { IMPLICIT_DEFAULT_RELEASE_GROUP } from '../config/config';
import { ReleaseGroupWithName } from '../config/filter-release-groups';

/**
 * Create a function that returns the touched projects for a given release group. Only relevant when version plans are enabled.
 */
export function createGetTouchedProjectsForGroup(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph,
  changedFiles: string[],
  fileData: FileData[]
) {
  /**
   * Create a minimal subset of touched projects based on the configured ignore patterns, we only need
   * to recompute when the ignorePatternsForPlanCheck differs between release groups.
   */
  const serializedIgnorePatternsToTouchedProjects = new Map<
    string,
    Record<string, true> // project names -> true for O(N) lookup later
  >();

  return async function getTouchedProjectsForGroup(
    releaseGroup: ReleaseGroupWithName,
    // We don't access releaseGroups.projects directly, because we need to take the --projects filter into account
    releaseGroupFilteredProjectNames: string[],
    hasProjectsFilter: boolean
  ): Promise<string[]> {
    // The current release group doesn't leverage version plans
    if (!releaseGroup.versionPlans) {
      return [];
    }

    // Exclude patterns from .nxignore, .gitignore and explicit version plan config
    let serializedIgnorePatterns = '[]';
    const ignore = getIgnoreObject();

    if (
      typeof releaseGroup.versionPlans !== 'boolean' &&
      Array.isArray(releaseGroup.versionPlans.ignorePatternsForPlanCheck) &&
      releaseGroup.versionPlans.ignorePatternsForPlanCheck.length
    ) {
      output.note({
        title: `Applying configured ignore patterns to changed files${
          releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
            ? ` for release group "${releaseGroup.name}"`
            : ''
        }`,
        bodyLines: [
          ...releaseGroup.versionPlans.ignorePatternsForPlanCheck.map(
            (pattern) => `  - ${pattern}`
          ),
        ],
      });
      ignore.add(releaseGroup.versionPlans.ignorePatternsForPlanCheck);
      serializedIgnorePatterns = JSON.stringify(
        releaseGroup.versionPlans.ignorePatternsForPlanCheck
      );
    }

    let touchedProjects = {};
    if (
      serializedIgnorePatternsToTouchedProjects.has(serializedIgnorePatterns)
    ) {
      touchedProjects = serializedIgnorePatternsToTouchedProjects.get(
        serializedIgnorePatterns
      );
    } else {
      // We only care about directly touched projects, not implicitly affected ones etc
      const touchedProjectsArr = await getTouchedProjects(
        calculateFileChanges(changedFiles, fileData, nxArgs, undefined, ignore),
        projectGraph.nodes
      );
      touchedProjects = touchedProjectsArr.reduce(
        (acc, project) => ({ ...acc, [project]: true }),
        {}
      );
      serializedIgnorePatternsToTouchedProjects.set(
        serializedIgnorePatterns,
        touchedProjects
      );
    }

    const touchedProjectsUnderReleaseGroup =
      releaseGroupFilteredProjectNames.filter(
        (project) => touchedProjects[project]
      );
    if (touchedProjectsUnderReleaseGroup.length) {
      output.log({
        title: `Touched projects${
          hasProjectsFilter ? ` (after --projects filter applied)` : ''
        } based on changed files${
          releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
            ? ` under release group "${releaseGroup.name}"`
            : ''
        }`,
        bodyLines: [
          ...touchedProjectsUnderReleaseGroup.map(
            (project) => `  - ${project}`
          ),
          '',
          'NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.',
        ],
      });
    } else {
      output.log({
        title: `No touched projects${
          hasProjectsFilter ? ` (after --projects filter applied)` : ''
        } found based on changed files${
          typeof releaseGroup.versionPlans !== 'boolean' &&
          Array.isArray(releaseGroup.versionPlans.ignorePatternsForPlanCheck) &&
          releaseGroup.versionPlans.ignorePatternsForPlanCheck.length
            ? ' combined with configured ignore patterns'
            : ''
        }${
          releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
            ? ` under release group "${releaseGroup.name}"`
            : ''
        }`,
      });
    }

    return touchedProjectsUnderReleaseGroup;
  };
}
