import { prompt } from 'enquirer';
import { RELEASE_TYPES, valid } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { getGitDiff, parseCommits } from './git';
import { determineSemverChange } from './semver';
import { getCommitsRelevantToProjects } from './shared';

export async function resolveSemverSpecifierFromConventionalCommits(
  from: string,
  projectGraph: ProjectGraph,
  projectNames: string[],
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): Promise<string | null> {
  const commits = await getGitDiff(from);
  const parsedCommits = parseCommits(commits);
  const relevantCommits = await getCommitsRelevantToProjects(
    projectGraph,
    parsedCommits,
    projectNames
  );
  return determineSemverChange(relevantCommits, conventionalCommitsConfig);
}

export async function resolveSemverSpecifierFromPrompt(
  selectionMessage: string,
  customVersionMessage: string
): Promise<string> {
  try {
    const reply = await prompt<{ specifier: string }>([
      {
        name: 'specifier',
        message: selectionMessage,
        type: 'select',
        choices: [
          ...RELEASE_TYPES.map((t) => ({ name: t, message: t })),
          {
            name: 'custom',
            message: 'Custom exact version',
          },
        ],
      },
    ]);
    if (reply.specifier !== 'custom') {
      return reply.specifier;
    } else {
      const reply = await prompt<{ specifier: string }>([
        {
          name: 'specifier',
          message: customVersionMessage,
          type: 'input',
          validate: (input) => {
            if (valid(input)) {
              return true;
            }
            return 'Please enter a valid semver version';
          },
        },
      ]);
      return reply.specifier;
    }
  } catch {
    // TODO: log the error to the user?
    // We need to catch the error from enquirer prompt, otherwise yargs will print its help
    process.exit(1);
  }
}
