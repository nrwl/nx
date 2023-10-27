import { prompt } from 'enquirer';
import { RELEASE_TYPES, valid } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { createProjectFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';
import { getGitDiff, parseCommits } from './git';
import { ConventionalCommitsConfig, determineSemverChange } from './semver';

// TODO: Extract config to nx.json configuration when adding changelog customization
const CONVENTIONAL_COMMITS_CONFIG: ConventionalCommitsConfig = {
  types: {
    feat: {
      semver: 'minor',
    },
    fix: {
      semver: 'patch',
    },
  },
};

export async function resolveSemverSpecifierFromConventionalCommits(
  from: string,
  projectGraph: ProjectGraph,
  projectNames: string[]
): Promise<string | null> {
  const commits = await getGitDiff(from);
  const parsedCommits = parseCommits(commits);
  const projectFileMap = await createProjectFileMapUsingProjectGraph(
    projectGraph
  );
  const filesInReleaseGroup = new Set<string>(
    projectNames.reduce(
      (files, p) => [...files, ...projectFileMap[p].map((f) => f.file)],
      [] as string[]
    )
  );

  const relevantCommits = parsedCommits.filter((c) =>
    c.affectedFiles.some((f) => filesInReleaseGroup.has(f))
  );

  return determineSemverChange(relevantCommits, CONVENTIONAL_COMMITS_CONFIG);
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
