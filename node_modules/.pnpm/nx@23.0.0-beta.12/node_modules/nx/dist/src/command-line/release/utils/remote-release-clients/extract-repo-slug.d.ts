import type { RemoteRepoSlug } from './remote-release-client';
/**
 * Extracts a GitHub-style repo slug (user/repo).
 */
export declare function extractGitHubRepoSlug(remoteUrl: string, expectedHostname: string): RemoteRepoSlug | null;
/**
 * Extracts a GitLab-style repo slug with full nested group path.
 */
export declare function extractGitLabRepoSlug(remoteUrl: string, expectedHostname: string): RemoteRepoSlug | null;
