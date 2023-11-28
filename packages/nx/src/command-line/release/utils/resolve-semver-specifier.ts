import { prompt } from 'enquirer';
import { RELEASE_TYPES, valid } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { createFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';
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
  const { fileMap } = await createFileMapUsingProjectGraph(projectGraph);
  const filesInReleaseGroup = new Set<string>(
    projectNames.reduce(
      (files, p) => [...files, ...fileMap.projectFileMap[p].map((f) => f.file)],
      [] as string[]
    )
  );

  /**
   * The relevant commits are those that either:
   * - touch project files which are contained within the release group directly
   * - touch non-project files and the commit is not scoped
   */
  const relevantCommits = parsedCommits.filter((c) =>
    c.affectedFiles.some(
      (f) =>
        filesInReleaseGroup.has(f) ||
        (!c.scope &&
          fileMap.nonProjectFiles.some(
            (nonProjectFile) => nonProjectFile.file === f
          ))
    )
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
