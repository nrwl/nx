import { exec } from 'node:child_process';
import { prerelease } from 'semver';
import type { ChangelogOptions } from '../command-object';
import type { NxReleaseConfig } from '../config/config';
import { RawVersionPlan } from '../config/version-plans';
import {
  getCommitHash,
  getFirstGitCommit,
  getLatestGitTagForPattern,
} from '../utils/git';
import type { VersionData } from '../utils/shared';

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
  const filteredPlans: RawVersionPlan[] = [];

  for (const plan of versionPlans) {
    const isInRange = await isVersionPlanInCommitRange(
      plan,
      fromSHA,
      toSHA,
      isVerbose
    );
    if (isInRange) {
      filteredPlans.push(plan);
    } else if (isVerbose) {
      console.log(
        `Filtering out version plan '${plan.fileName}' as it was not committed in the range ${fromSHA}..${toSHA}`
      );
    }
  }

  if (isVerbose) {
    console.log(
      `Filtered ${versionPlans.length} version plans down to ${filteredPlans.length} based on commit range`
    );
  }

  return filteredPlans;
}

/**
 * Checks if a version plan file was added in the commit range
 * @param versionPlan The version plan to check
 * @param fromSHA The starting commit SHA (exclusive)
 * @param toSHA The ending commit SHA (inclusive)
 * @param isVerbose Whether to output verbose logging
 * @returns True if the version plan was added in the commit range
 */
async function isVersionPlanInCommitRange(
  versionPlan: RawVersionPlan,
  fromSHA: string,
  toSHA: string,
  isVerbose: boolean
): Promise<boolean> {
  return new Promise((resolve) => {
    // Use git log to check if the file was added (A) in the commit range
    const command = `git log ${fromSHA}..${toSHA} --diff-filter=A --pretty=format:"%H" -- ${versionPlan.absolutePath}`;

    exec(
      command,
      {
        windowsHide: false,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (isVerbose) {
            console.error(
              `Error checking commit range for ${versionPlan.relativePath}: ${error.message}`
            );
          }
          // If there's an error, we'll include the plan to be safe
          return resolve(true);
        }
        if (stderr && isVerbose) {
          console.error(
            `Git command stderr for ${versionPlan.relativePath}: ${stderr}`
          );
        }

        // If stdout has content, the file was added in the range
        const hasCommit = stdout.trim().length > 0;
        if (isVerbose && hasCommit) {
          console.log(
            `Version plan '${versionPlan.fileName}' was added in commit range`
          );
        }
        resolve(hasCommit);
      }
    );
  });
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
}: {
  fromRef?: string;
  tagPattern: string;
  tagPatternValues: Record<string, string>;
  checkAllBranchesWhen: boolean | string[];
  preid?: string;
  requireSemver: boolean;
  strictPreid: boolean;
  useAutomaticFromRef: boolean;
}): Promise<string | null> {
  // If user provided a from ref, resolve it to a SHA
  if (fromRef) {
    return await getCommitHash(fromRef);
  }
  // Otherwise, try to resolve it from the latest tag
  const latestTag = await getLatestGitTagForPattern(
    tagPattern,
    tagPatternValues,
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
}: {
  args: ChangelogOptions;
  nxReleaseConfig: NxReleaseConfig;
  useAutomaticFromRef: boolean;
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
