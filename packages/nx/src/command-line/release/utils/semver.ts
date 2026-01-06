/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */

import { major, RELEASE_TYPES, ReleaseType, inc, valid } from 'semver';
import { NxReleaseConfig } from '../config/config';
import { GitCommit } from './git';

export const enum SemverSpecifier {
  MAJOR = 3,
  MINOR = 2,
  PATCH = 1,
}

export const SemverSpecifierType = {
  3: 'major',
  2: 'minor',
  1: 'patch',
};

export function isRelativeVersionKeyword(val: string): val is ReleaseType {
  return RELEASE_TYPES.includes(val as ReleaseType);
}

export function isValidSemverSpecifier(specifier: string): boolean {
  return (
    specifier && !!(valid(specifier) || isRelativeVersionKeyword(specifier))
  );
}

export function determineSemverChange(
  relevantCommits: Map<
    string,
    { commit: GitCommit; isProjectScopedCommit: boolean }[]
  >,
  config: NxReleaseConfig['conventionalCommits']
): Map<string, SemverSpecifier | null> {
  const semverChangePerProject: Map<string, SemverSpecifier | null> = new Map();
  for (const [projectName, relevantCommit] of relevantCommits) {
    let highestChange: SemverSpecifier | null = null;

    for (const { commit, isProjectScopedCommit } of relevantCommit) {
      if (config.useCommitScope && !isProjectScopedCommit) {
        // commit is relevant to the project, but not directly, report patch change to match side-effectful bump behavior in update dependents in release-group-processor
        highestChange = Math.max(SemverSpecifier.PATCH, highestChange ?? 0);
        continue;
      }
      const semverType = config.types[commit.type]?.semverBump;
      if (semverType === 'major' || commit.isBreaking) {
        highestChange = Math.max(SemverSpecifier.MAJOR, highestChange ?? 0);
        break; // Major is highest priority, no need to check more commits
      } else if (semverType === 'minor') {
        highestChange = Math.max(SemverSpecifier.MINOR, highestChange ?? 0);
      } else if (semverType === 'patch') {
        highestChange = Math.max(SemverSpecifier.PATCH, highestChange ?? 0);
      }
    }

    semverChangePerProject.set(projectName, highestChange);
  }

  return semverChangePerProject;
}

/**
 * For 0.x versions, shifts semver bump types down to follow
 * the common convention where breaking changes bump minor, and
 * new features bump patch.
 *
 * - 'major' -> 'minor'
 * - 'premajor' -> 'preminor'
 * - 'minor' -> 'patch'
 * - 'preminor' -> 'prepatch'
 * - 'patch' -> 'patch' (unchanged)
 * - 'prepatch' -> 'prepatch' (unchanged)
 * - 'prerelease' -> 'prerelease' (unchanged)
 */
function adjustSpecifierForZeroMajorVersion(
  specifier: string,
  currentVersion: string
): string {
  // Only adjust for 0.x versions
  if (major(currentVersion) !== 0) {
    return specifier;
  }

  switch (specifier) {
    case 'major':
      return 'minor';
    case 'premajor':
      return 'preminor';
    case 'minor':
      return 'patch';
    case 'preminor':
      return 'prepatch';
    default:
      return specifier;
  }
}

export function deriveNewSemverVersion(
  currentSemverVersion: string,
  semverSpecifier: string,
  preid?: string
) {
  if (!valid(currentSemverVersion)) {
    throw new Error(
      `Invalid semver version "${currentSemverVersion}" provided.`
    );
  }

  let newVersion = semverSpecifier;
  if (isRelativeVersionKeyword(semverSpecifier)) {
    // Adjust for 0.x versions
    const adjustedSpecifier = adjustSpecifierForZeroMajorVersion(
      semverSpecifier,
      currentSemverVersion
    );
    // Derive the new version from the current version combined with the adjusted version specifier.
    const derivedVersion = inc(
      currentSemverVersion,
      adjustedSpecifier as ReleaseType,
      preid
    );
    if (!derivedVersion) {
      throw new Error(
        `Unable to derive new version from current version "${currentSemverVersion}" and version specifier "${semverSpecifier}"`
      );
    }
    newVersion = derivedVersion;
  } else {
    // Ensure the new version specifier is a valid semver version, given it is not a valid semver keyword
    if (!valid(semverSpecifier)) {
      throw new Error(
        `Invalid semver version specifier "${semverSpecifier}" provided. Please provide either a valid semver version or a valid semver version keyword.`
      );
    }
  }
  return newVersion;
}
