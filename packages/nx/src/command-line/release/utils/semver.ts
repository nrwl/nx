/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */

import { RELEASE_TYPES, ReleaseType, inc, valid } from 'semver';
import { NxReleaseConfig } from '../config/config.js';
import { GitCommit } from './git.js';

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
      if (!isProjectScopedCommit) {
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
    // Derive the new version from the current version combined with the new version specifier.
    const derivedVersion = inc(currentSemverVersion, semverSpecifier, preid);
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
