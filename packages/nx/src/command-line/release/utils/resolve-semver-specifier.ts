import { prompt } from 'enquirer';
import { RELEASE_TYPES, valid } from 'semver';
import { ProjectGraph } from '../../../config/project-graph.js';
import { NxReleaseConfig } from '../config/config.js';
import { SemverBumpType } from '../version/version-actions.js';
import { getGitDiff, parseCommits } from './git.js';
import { determineSemverChange, SemverSpecifier } from './semver.js';
import { getCommitsRelevantToProjects } from './shared.js';

export async function resolveSemverSpecifierFromConventionalCommits(
  from: string,
  projectGraph: ProjectGraph,
  projectNames: string[],
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): // Map of projectName to semver bump type
Promise<Map<string, SemverSpecifier | null>> {
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
): Promise<SemverBumpType | string> {
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
      return reply.specifier as SemverBumpType;
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
    // Ensure the cursor is always restored before exiting
    process.stdout.write('\u001b[?25h');
    // We need to catch the error from enquirer prompt, otherwise yargs will print its help
    process.exit(1);
  }
}
