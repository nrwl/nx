import { execSync } from 'child_process';
import { logger } from '../devkit-exports';

export function getGithubSlugOrNull(): string | null {
  try {
    const gitRemote = execSync('git remote -v').toString();
    return extractUserAndRepoFromGitHubUrl(gitRemote);
  } catch (e) {
    return null;
  }
}

export function extractUserAndRepoFromGitHubUrl(
  gitRemotes: string
): string | null {
  const regex =
    /^\s*(\w+)\s+(git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/gm;
  let firstGitHubUrl: string | null = null;
  let match;

  while ((match = regex.exec(gitRemotes)) !== null) {
    const remoteName = match[1];
    const url = match[2] + match[3] + '/' + match[4] + '.git';

    if (remoteName === 'origin') {
      return parseGitHubUrl(url);
    }

    if (!firstGitHubUrl) {
      firstGitHubUrl = url;
    }
  }

  return firstGitHubUrl ? parseGitHubUrl(firstGitHubUrl) : null;
}

function parseGitHubUrl(url: string): string | null {
  const sshPattern =
    /git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/;
  const httpsPattern =
    /https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/;
  let match = url.match(sshPattern) || url.match(httpsPattern);

  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return null;
}

export function commitChanges(
  commitMessage: string,
  directory?: string
): string | null {
  try {
    execSync('git add -A', { encoding: 'utf8', stdio: 'pipe' });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
      cwd: directory,
    });
  } catch (err) {
    if (directory) {
      // We don't want to throw during create-nx-workspace
      // because maybe there was an error when setting up git
      // initially.
      logger.verbose(`Git may not be set up correctly for this new workspace.
        ${err}`);
    } else {
      throw new Error(`Error committing changes:\n${err.stderr}`);
    }
  }

  return getLatestCommitSha();
}

export function getLatestCommitSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  } catch {
    return null;
  }
}
