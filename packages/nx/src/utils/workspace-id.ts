import { createHash } from 'crypto';
import { readNxJson } from '../config/nx-json';
import {
  getFirstCommitSha,
  getGitRootRelativePath,
  getVcsRemoteInfo,
  isShallowRepository,
} from './git-utils';

/**
 * The workspace's analytics identity: the Nx Cloud id when the workspace has
 * one (most stable — it survives repo moves and renames), else the repo key.
 * Null when neither is available, in which case nothing is reported.
 */
export function generateWorkspaceId(root: string): string | null {
  const nxJson = readNxJson(root);
  const nxCloudId = nxJson?.nxCloudId ?? nxJson?.nxCloudAccessToken;
  if (nxCloudId) {
    return nxCloudId;
  }
  return deriveRepoKey(root);
}

/**
 * Derive the stable, unsalted key identifying this workspace in the
 * repoTelemetry registry: `sha256(<repo identity> + '#' + <workspace path
 * relative to the git root>)`.
 *
 * The repo identity is the normalized `domain/slug` from the git remote
 * (protocol-independent: ssh, https, and token-authenticated URLs of the
 * same repo produce the same key), falling back to the first-commit SHA
 * when no remote exists. Returns null when no identity is derivable — not
 * a git repository, or a shallow clone without a remote.
 */
export function deriveRepoKey(directory: string): string | null {
  const identity = getRepoIdentity(directory);
  if (!identity) {
    return null;
  }
  return computeRepoKey(identity, getGitRootRelativePath(directory) ?? '');
}

export function computeRepoKey(identity: string, relativePath: string): string {
  return createHash('sha256')
    .update(`${identity}#${relativePath}`)
    .digest('hex');
}

function getRepoIdentity(directory: string): string | null {
  const remote = getVcsRemoteInfo(directory);
  if (remote) {
    // Hosts route case-insensitively and hold one canonical casing, so a
    // hand-typed remote must key the same as the canonical one the claim
    // flow derives from the host's API.
    return `${remote.domain}/${remote.slug}`.toLowerCase().replace(/\/+$/, '');
  }
  // Without a remote the first commit is the only stable identity, and a
  // shallow clone doesn't have a real one.
  return isShallowRepository(directory) ? null : getFirstCommitSha(directory);
}
