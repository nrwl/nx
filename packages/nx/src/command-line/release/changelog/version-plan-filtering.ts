import { join } from 'path';
import { prerelease } from 'semver';
import { workspaceRoot } from '../../../utils/workspace-root';
import type { ChangelogOptions } from '../command-object';
import type { NxReleaseConfig } from '../config/config';
import { RawVersionPlan } from '../config/version-plans';
import { execCommand } from '../utils/exec-command';
import {
  getCommitHash,
  getFirstGitCommit,
  getLatestGitTagForPattern,
} from '../utils/git';
import type { VersionData } from '../utils/shared';
import type {
  CheckAllBranchesWhen,
  RepoGitTags,
} from '../utils/repository-git-tags';

/**
 * Filters version plans to only include those that were committed between the specified SHAs
 * @param versionPlans The raw version plans to filter
 * @param fromSHA The starting commit SHA (exclusive)
 * @param toSHA The ending commit SHA (inclusive)
 * @param isVerbose Whether to output verbose logging
 * @returns The filtered version plans
 */
export async function filterVersionPlansByCommitRange(
  versionPlans: RawVersionPlan[],
  fromSHA: string,
  toSHA: string,
  isVerbose: boolean
): Promise<RawVersionPlan[]> {
  if (versionPlans.length === 0) {
    return [];
  }

  // Get all files added within the commit range with a single git command
  const filesAddedInRange = await getFilesAddedInCommitRange(
    fromSHA,
    toSHA,
    isVerbose
  );

  // Filter version plans based on whether they were added in the range
  const filteredPlans = versionPlans.filter((plan) => {
    const isInRange = filesAddedInRange.has(plan.absolutePath);
    if (!isInRange && isVerbose) {
      console.log(
        `Filtering out version plan '${plan.fileName}' as it was not committed in the range ${fromSHA}..${toSHA}`
      );
    } else if (isInRange && isVerbose) {
      console.log(`Version plan '${plan.fileName}' was added in commit range`);
    }
    return isInRange;
  });

  if (isVerbose) {
    console.log(
      `Filtered ${versionPlans.length} version plans down to ${filteredPlans.length} based on commit range`
    );
  }

  return filteredPlans;
}

/**
 * Gets all version plan files that were added within the commit range
 * @param fromSHA The starting commit SHA (exclusive)
 * @param toSHA The ending commit SHA (inclusive)
 * @param isVerbose Whether to output verbose logging
 * @returns Set of absolute file paths that were added in the range
 */
async function getFilesAddedInCommitRange(
  fromSHA: string,
  toSHA: string,
  isVerbose: boolean
): Promise<Set<string>> {
  try {
    // Use git log to get version plan files added within the commit range
    // --name-only shows just the file paths
    // --diff-filter=A shows only added files
    // -- .nx/version-plans/ limits to only files in that directory
    // Note: Git pathspecs always use forward slashes, even on Windows
    const stdout = await execCommand('git', [
      'log',
      `${fromSHA}..${toSHA}`,
      '--diff-filter=A',
      '--name-only',
      '--pretty=format:',
      '--',
      '.nx/version-plans/',
    ]);

    // Parse the output to get unique file paths
    const files = stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((relativePath) => {
        // Convert relative paths to absolute paths
        return join(workspaceRoot, relativePath);
      });
    const uniqueFiles = new Set(files);

    if (isVerbose && uniqueFiles.size > 0) {
      console.log(
        `Found ${uniqueFiles.size} version plan files added in commit range`
      );
    }

    return uniqueFiles;
  } catch (err) {
    if (isVerbose) {
      console.error(
        `Error getting files in commit range: ${err.message || err}`
      );
    }
    // If there's an error, return empty set (no filtering)
    return new Set();
  }
}

/**
 * Resolves the "from SHA" for changelog purposes.
 * This determines the starting point for changelog generation and optional version plan filtering.
 */
export async function resolveChangelogFromSHA({
  fromRef,
  tagPattern,
  tagPatternValues,
  checkAllBranchesWhen,
  preid,
  requireSemver,
  strictPreid,
  useAutomaticFromRef,
  resolveRepositoryTags,
}: {
  fromRef?: string;
  tagPattern: string;
  tagPatternValues: Record<string, string>;
  checkAllBranchesWhen: CheckAllBranchesWhen;
  preid?: string;
  requireSemver: boolean;
  strictPreid: boolean;
  useAutomaticFromRef: boolean;
  resolveRepositoryTags: RepoGitTags['resolveTags'];
}): Promise<string | null> {
  // If user provided a from ref, resolve it to a SHA
  if (fromRef) {
    return await getCommitHash(fromRef);
  }
  // Otherwise, try to resolve it from the latest tag
  const latestTag = await getLatestGitTagForPattern(
    tagPattern,
    tagPatternValues,
    resolveRepositoryTags,
    {
      checkAllBranchesWhen,
      preid,
      requireSemver,
      strictPreid,
    }
  );
  if (latestTag?.tag) {
    return await getCommitHash(latestTag.tag);
  }
  // Finally, if automatic from ref is enabled, use the first commit as a fallback
  if (useAutomaticFromRef) {
    return await getFirstGitCommit();
  }

  return null;
}

/**
 * Helper function for workspace-level "from SHA" resolution.
 * Extracts preids and calls the generic resolver.
 */
export async function resolveWorkspaceChangelogFromSHA({
  args,
  nxReleaseConfig,
  useAutomaticFromRef,
  resolveRepositoryTags,
}: {
  args: ChangelogOptions;
  nxReleaseConfig: NxReleaseConfig;
  useAutomaticFromRef: boolean;
  resolveRepositoryTags: RepoGitTags['resolveTags'];
}): Promise<string | null> {
  const workspacePreid = extractPreidFromVersion(args.version);
  const projectsPreid = extractProjectsPreidFromVersionData(args.versionData);

  return resolveChangelogFromSHA({
    fromRef: args.from,
    tagPattern: nxReleaseConfig.releaseTag.pattern,
    tagPatternValues: {},
    checkAllBranchesWhen: nxReleaseConfig.releaseTag.checkAllBranchesWhen,
    preid: workspacePreid ?? projectsPreid?.[Object.keys(projectsPreid)[0]],
    requireSemver: nxReleaseConfig.releaseTag.requireSemver,
    strictPreid: nxReleaseConfig.releaseTag.strictPreid,
    useAutomaticFromRef,
    resolveRepositoryTags,
  });
}

export function extractPreidFromVersion(
  version: string | null | undefined
): string | undefined {
  try {
    const preid = prerelease(version)?.[0];
    return typeof preid === 'string' ? preid : undefined;
  } catch {
    return undefined;
  }
}

export function extractProjectsPreidFromVersionData(
  versionData: VersionData | undefined
): Record<string, string | undefined> | undefined {
  if (!versionData) {
    return undefined;
  }

  const result: Record<string, string | undefined> = {};
  for (const [project, data] of Object.entries(versionData)) {
    if (data?.newVersion) {
      result[project] = extractPreidFromVersion(data.newVersion);
    }
  }
  return result;
}
