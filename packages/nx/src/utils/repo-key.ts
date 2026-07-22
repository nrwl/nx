import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { relative } from 'path';
import { getVcsRemoteInfo } from './git-utils';
import { workspaceRoot } from './workspace-root';

/**
 * Derive the stable, unsalted key identifying this workspace in the
 * repoTelemetry registry: `sha256(<repo identity> + '#' + <workspace path
 * relative to the git root>)`.
 *
 * The repo identity is the normalized `domain/slug` from the git remote
 * (protocol-independent: ssh, https, and token-authenticated URLs of the
 * same repo produce the same key), falling back to the first-commit SHA
 * when no remote exists. Returns null when no identity is derivable — not
 * a git repository, or a shallow clone without a remote (its truncated
 * history cannot produce a stable first-commit SHA).
 */
export function deriveRepoKey(
  directory: string = workspaceRoot
): string | null {
  const identity = getRepoIdentity(directory);
  if (!identity) {
    return null;
  }
  return computeRepoKey(identity, getGitRootRelativePath(directory));
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
  return getFirstCommitSha(directory);
}

/**
 * Path of the workspace relative to the git root, posix-separated ('' when
 * the workspace is the git root), so nested workspaces in one repo get
 * distinct keys and the same key on every OS.
 */
function getGitRootRelativePath(directory: string): string {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: directory,
      stdio: 'pipe',
      windowsHide: true,
    })
      .toString()
      .trim();
    return relative(gitRoot, directory).split('\\').join('/');
  } catch {
    return '';
  }
}

function getFirstCommitSha(directory: string): string | null {
  try {
    const isShallow = execSync('git rev-parse --is-shallow-repository', {
      cwd: directory,
      stdio: 'pipe',
      windowsHide: true,
    })
      .toString()
      .trim();
    // A shallow clone's truncated history yields a fake root commit
    if (isShallow === 'true') {
      return null;
    }
    const roots = execSync('git rev-list --max-parents=0 HEAD', {
      cwd: directory,
      stdio: 'pipe',
      windowsHide: true,
    })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
    // Multiple roots are possible (merged unrelated histories) — pick
    // deterministically
    return roots.sort()[0] ?? null;
  } catch {
    return null;
  }
}
