import { selectPrompt, textPrompt } from '../../../utils/prompt-helpers';
import { RELEASE_TYPES, valid } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { SemverBumpType } from '../version/version-actions';
import { getGitDiff, parseCommits } from './git';
import { ReleaseGraph } from './release-graph';
import { determineSemverChange, SemverSpecifier } from './semver';
import { getCommitsRelevantToProjects } from './shared';

export async function resolveSemverSpecifierFromConventionalCommits(
  from: string,
  projectGraph: ProjectGraph,
  projectNames: string[],
  releaseConfig: NxReleaseConfig,
  releaseGraph: ReleaseGraph,
  // The full set of projects in the active release group. For independent
  // release groups, `projectNames` only contains the single project being
  // processed, so this is forwarded separately to keep scope matching
  // accurate against the whole group. Defaults to `projectNames`.
  releaseGroupProjects: string[] = projectNames
): // Map of projectName to semver bump type
Promise<Map<string, SemverSpecifier | null>> {
  const commits = await getGitDiff(from);
  const parsedCommits = parseCommits(commits);
  const relevantCommits = await getCommitsRelevantToProjects(
    projectGraph,
    parsedCommits,
    projectNames,
    releaseConfig,
    releaseGraph,
    releaseGroupProjects
  );
  return determineSemverChange(
    relevantCommits,
    releaseConfig.conventionalCommits
  );
}

export async function resolveSemverSpecifierFromPrompt(
  selectionMessage: string,
  customVersionMessage: string
): Promise<SemverBumpType | string> {
  // Cancelling exits rather than returning, so yargs never prints its help for
  // what the user meant as an abort.
  const abort = (): never => process.exit(1);

  const specifier = await selectPrompt({
    message: selectionMessage,
    choices: [
      ...RELEASE_TYPES,
      { value: 'custom', label: 'Custom exact version' },
    ],
    onCancel: abort,
  });

  if (specifier !== 'custom') {
    return specifier as SemverBumpType;
  }

  return textPrompt({
    message: customVersionMessage,
    validate: (input) =>
      valid(input) ? undefined : 'Please enter a valid semver version',
    onCancel: abort,
  });
}
