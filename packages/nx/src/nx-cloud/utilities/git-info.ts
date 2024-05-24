import { execSync } from 'child_process';

export function getGithubSlugOrNull(): string | null {
  const gitRemote = execSync('git remote -v').toString();
  return extractUserAndRepoFromGitHubUrl(gitRemote);
}

function extractUserAndRepoFromGitHubUrl(gitRemotes: string): string | null {
  const regex =
    /^(\w+)\s+(git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/gm;
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
