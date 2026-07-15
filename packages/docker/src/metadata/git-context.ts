import { readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  getCurrentBranchName,
  getCurrentTagName,
  getDefaultBranchName,
  getLatestCommitSha,
  getVcsRemoteInfo,
} from 'nx/src/utils/git-utils';
import { GitRefContext, RepoContext } from './types';

/**
 * Builds the `refs/heads/x` / `refs/tags/x` shaped context the ported tag-matching algorithm in
 * `version-resolver.ts` expects, from local git state instead of a GitHub Actions event payload.
 *
 * `NX_DOCKER_REF` is an escape hatch for CI checkouts of a PR merge ref (e.g.
 * `refs/pull/123/merge`) — there's no local-git equivalent of that ref shape once checked out as
 * a detached HEAD, so CI can set this env var explicitly to restore `type=ref,event=pr` matching.
 * `NX_DOCKER_METADATA_EVENT` mirrors the GitHub Actions "event name" that gates the `schedule`
 * tag type; it defaults to `''` (inert) since there's no local notion of a scheduled/cron run.
 */
export function getGitRefContext(directory?: string): GitRefContext {
  const tag = getCurrentTagName(directory);
  const branch = getCurrentBranchName(directory);
  const sha = getLatestCommitSha(directory) ?? undefined;
  const defaultBranch = getDefaultBranchName(directory);

  const ref =
    process.env.NX_DOCKER_REF ??
    (tag ? `refs/tags/${tag}` : branch ? `refs/heads/${branch}` : '');

  return {
    ref,
    sha,
    isDefaultBranch: !!branch && !!defaultBranch && branch === defaultBranch,
    eventName: process.env.NX_DOCKER_METADATA_EVENT ?? '',
  };
}

/**
 * Best-effort, local approximation of the OCI label source data the original sourced from the
 * GitHub API (`RepoMetadata`): name/description/license come from `package.json`/`project.json`,
 * the remote URL from the workspace's git remote, and the default branch from local git.
 */
export function getRepoContext(
  projectRoot: string,
  workspaceRoot: string
): RepoContext {
  let name = '';
  let description = '';
  let license: string | undefined;

  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = readJsonFile(packageJsonPath);
      name = packageJson.name ?? name;
      description = packageJson.description ?? description;
      license =
        typeof packageJson.license === 'string'
          ? packageJson.license
          : undefined;
    } catch {
      // malformed package.json — fall through to project.json/defaults
    }
  }

  if (!name) {
    const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
    if (existsSync(projectJsonPath)) {
      try {
        const projectJson = readJsonFile(projectJsonPath);
        name = projectJson.name ?? name;
      } catch {
        // malformed project.json — fall through to defaults
      }
    }
  }

  const remote = getVcsRemoteInfo(workspaceRoot);
  const url = remote ? `https://${remote.domain}/${remote.slug}` : '';

  return {
    name,
    description,
    url,
    defaultBranch: getDefaultBranchName(workspaceRoot) ?? '',
    license,
  };
}
