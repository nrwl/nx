import { execSync } from 'child_process';
import { deduceDefaultBase } from './default-base';
import { output } from '../output';
import { execAndWait, spawnAndWait } from '../child-process-utils';
import * as enquirer from 'enquirer';

export enum VcsPushStatus {
  PushedToVcs = 'PushedToVcs',
  OptedOutOfPushingToVcs = 'OptedOutOfPushingToVcs',
  FailedToPushToVcs = 'FailedToPushToVcs',
  SkippedGit = 'SkippedGit',
}

export class GitHubPushSkippedError extends Error {
  public readonly title = 'Push your workspace';

  constructor(message: string) {
    super(message);
    this.name = 'GitHubPushSkippedError';
  }
}

export async function checkGitVersion(): Promise<string | null | undefined> {
  try {
    const result = await execAndWait('git --version', process.cwd());
    const gitVersionOutput = result.stdout.trim();
    return gitVersionOutput.match(/[0-9]+\.[0-9]+\.+[0-9]+/)?.[0];
  } catch {
    return null;
  }
}

async function getGitHubUsername(directory: string): Promise<string> {
  const result = await execAndWait('gh api user --jq .login', directory);
  const username = result.stdout.trim();
  if (!username) {
    throw new GitHubPushSkippedError('GitHub CLI is not authenticated');
  }
  return username;
}

async function getUserRepositories(directory: string): Promise<Set<string>> {
  try {
    const allRepos = new Set<string>();

    // Get user's personal repos and organizations concurrently
    const [userRepos, orgsResult] = await Promise.all([
      execAndWait(
        'gh repo list --limit 1000 --json nameWithOwner --jq ".[].nameWithOwner"',
        directory
      ),
      execAndWait('gh api user/orgs --jq ".[].login"', directory),
    ]);

    // Add user's personal repos
    userRepos.stdout
      .trim()
      .split('\n')
      .filter((repo) => repo.length > 0)
      .forEach((repo) => allRepos.add(repo));

    // Parse organizations
    const orgs = orgsResult.stdout
      .trim()
      .split('\n')
      .filter((org) => org.length > 0);

    // Get repos from all organizations concurrently
    const orgRepoPromises = orgs.map(async (org) => {
      try {
        const orgRepos = await execAndWait(
          `gh repo list ${org} --limit 1000 --json nameWithOwner --jq ".[].nameWithOwner"`,
          directory
        );
        return orgRepos.stdout
          .trim()
          .split('\n')
          .filter((repo) => repo.length > 0);
      } catch {
        // Return empty array if we can't access org repos
        return [];
      }
    });

    const orgRepoResults = await Promise.all(orgRepoPromises);

    // Add all org repos to the set
    orgRepoResults.flat().forEach((repo) => allRepos.add(repo));

    return allRepos;
  } catch {
    // If we can't fetch repos, return empty set to skip validation
    return new Set();
  }
}

export async function initializeGitRepo(
  directory: string,
  options: {
    defaultBase: string;
    commit?: { message: string; name: string; email: string };
    connectUrl?: string | null;
  }
) {
  // Set git commit environment variables if provided
  if (options.commit?.name) {
    process.env.GIT_AUTHOR_NAME = options.commit.name;
    process.env.GIT_COMMITTER_NAME = options.commit.name;
  }
  if (options.commit?.email) {
    process.env.GIT_AUTHOR_EMAIL = options.commit.email;
    process.env.GIT_COMMITTER_EMAIL = options.commit.email;
  }

  const gitVersion = await checkGitVersion();
  if (!gitVersion) {
    return;
  }
  const insideRepo = await execAndWait(
    'git rev-parse --is-inside-work-tree',
    directory,
    true
  ).then(
    () => true,
    () => false
  );
  if (insideRepo) {
    output.log({
      title:
        'Directory is already under version control. Skipping initialization of git.',
    });
    return;
  }
  const defaultBase = options.defaultBase || deduceDefaultBase();
  const [gitMajor, gitMinor] = gitVersion.split('.');

  if (+gitMajor > 2 || (+gitMajor === 2 && +gitMinor >= 28)) {
    await execAndWait(`git init -b ${defaultBase}`, directory);
  } else {
    await execAndWait('git init', directory);
    await execAndWait(`git checkout -b ${defaultBase}`, directory); // Git < 2.28 doesn't support -b on git init.
  }
  await execAndWait('git add .', directory);
  if (options.commit) {
    let message = `${options.commit.message}` || 'initial commit';
    if (options.connectUrl) {
      message = `${message}

To connect your workspace to Nx Cloud, push your repository
to your git hosting provider and go to the following URL:
  
${options.connectUrl}
`;
    }
    await execAndWait(`git commit -m "${message}"`, directory);
  }
}

export async function pushToGitHub(
  directory: string,
  options: {
    skipGitHubPush?: boolean;
    name: string;
    defaultBase: string;
    verbose?: boolean;
  }
): Promise<VcsPushStatus> {
  try {
    if (process.env['NX_SKIP_GH_PUSH'] === 'true') {
      throw new GitHubPushSkippedError(
        'NX_SKIP_GH_PUSH is true so skipping GitHub push.'
      );
    }

    const username = await getGitHubUsername(directory);

    // First prompt: Ask if they want to push to GitHub
    const { push } = await enquirer.prompt<{ push: 'Yes' | 'No' }>([
      {
        name: 'push',
        message: 'Would you like to push this workspace to Github?',
        type: 'autocomplete',
        choices: [{ name: 'Yes' }, { name: 'No' }],
        initial: 0,
      },
    ]);

    if (push !== 'Yes') {
      return VcsPushStatus.OptedOutOfPushingToVcs;
    }

    // Preload existing repositories for validation
    const existingRepos = await getUserRepositories(directory);

    // Create default repository name using the username we already have
    const defaultRepo = `${username}/${options.name}`;

    // Second prompt: Ask where to create the repository with validation
    const { repoName } = await enquirer.prompt<{ repoName: string }>([
      {
        name: 'repoName',
        message: 'Repository name (format: username/repo-name):',
        type: 'input',
        initial: defaultRepo,
        validate: async (value: string): Promise<any> => {
          if (!value.includes('/')) {
            return 'Repository name must be in format: username/repo-name';
          }

          if (existingRepos.has(value)) {
            return `Repository '${value}' already exists. Please choose a different name.`;
          }

          return true;
        },
      },
    ]);

    // Create GitHub repository using gh CLI from the workspace directory
    // This will automatically add remote origin and push the current branch
    await spawnAndWait(
      'gh',
      [
        'repo',
        'create',
        repoName,
        '--private',
        '--push',
        '--source',
        directory,
      ],
      directory
    );

    // Get the actual repository URL from GitHub CLI (it could be different from github.com)
    const repoResult = await execAndWait(
      'gh repo view --json url -q .url',
      directory
    );
    const repoUrl = repoResult.stdout.trim();

    output.success({
      title: `Successfully pushed to GitHub repository: ${repoUrl}`,
    });
    return VcsPushStatus.PushedToVcs;
  } catch (e) {
    const isVerbose =
      options.verbose || process.env.NX_VERBOSE_LOGGING === 'true';
    const errorMessage = e instanceof Error ? e.message : String(e);

    // Error code 127 means gh wasn't installed
    const title =
      e instanceof GitHubPushSkippedError || (e as any)?.code === 127
        ? 'Push your workspace to GitHub.'
        : 'Failed to push workspace to GitHub.';

    const createRepoUrl = `https://github.com/new?name=${encodeURIComponent(
      options.name
    )}`;
    output.log({
      title,
      bodyLines: isVerbose
        ? [
            `Please create a repo at ${createRepoUrl} and push this workspace.`,
            'Error details:',
            errorMessage,
          ]
        : [`Please create a repo at ${createRepoUrl} and push this workspace.`],
    });
    return VcsPushStatus.FailedToPushToVcs;
  }
}
