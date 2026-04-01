import type { RemoteRepoSlug } from './remote-release-client';

/**
 * Extracts a GitHub-style repo slug (user/repo).
 */
export function extractGitHubRepoSlug(
  remoteUrl: string,
  expectedHostname: string
): RemoteRepoSlug | null {
  return extractRepoSlug(remoteUrl, expectedHostname, 2);
}

/**
 * Extracts a GitLab-style repo slug with full nested group path.
 */
export function extractGitLabRepoSlug(
  remoteUrl: string,
  expectedHostname: string
): RemoteRepoSlug | null {
  return extractRepoSlug(remoteUrl, expectedHostname, Infinity);
}

const SCP_URL_REGEX = /^git@([^:]+):(.+)$/;

/**
 * Extracts a repository slug from a Git remote URL.
 * `segmentLimit` = 2 for GitHub (user/repo), `Infinity` for GitLab (with subgroups).
 */
function extractRepoSlug(
  remoteUrl: string,
  expectedHostname: string,
  segmentLimit: number
): RemoteRepoSlug | null {
  if (!remoteUrl) return null;

  // SCP-like: git@host:path
  const scpMatch = remoteUrl.match(SCP_URL_REGEX);
  if (scpMatch) {
    const [, host, path] = scpMatch;
    if (!isHostMatch(host, expectedHostname)) return null;

    const segments = normalizeRepoPath(path).split('/').filter(Boolean);
    if (segments.length < 2) return null;

    return segments.slice(0, segmentLimit).join('/') as RemoteRepoSlug;
  }

  // URL-like
  try {
    const url = new URL(remoteUrl);
    if (!isHostMatch(url.hostname, expectedHostname)) return null;

    const segments = normalizeRepoPath(url.pathname).split('/').filter(Boolean);
    if (segments.length < 2) return null;

    return segments.slice(0, segmentLimit).join('/') as RemoteRepoSlug;
  } catch {
    return null;
  }
}

function normalizeRepoPath(s: string): string {
  return s.replace(/^\/+|\/+$|\.git$/g, '');
}

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^ssh\./, '')
    .split(':')[0];
}

function isHostMatch(actual: string, expected: string): boolean {
  return normalizeHostname(actual) === normalizeHostname(expected);
}
