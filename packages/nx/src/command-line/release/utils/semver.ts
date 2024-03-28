/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */

import { RELEASE_TYPES, ReleaseType, inc, valid } from 'semver';
import { NxReleaseConfig } from '../config/config';
import { GitCommit } from './git';

export function isRelativeVersionKeyword(val: string): val is ReleaseType {
  return RELEASE_TYPES.includes(val as ReleaseType);
}

export function isValidSemverSpecifier(specifier: string): boolean {
  return (
    specifier && !!(valid(specifier) || isRelativeVersionKeyword(specifier))
  );
}

// https://github.com/unjs/changelogen/blob/main/src/semver.ts
export function determineSemverChange(
  commits: GitCommit[],
  config: NxReleaseConfig['conventionalCommits']
): 'patch' | 'minor' | 'major' | null {
  let [hasMajor, hasMinor, hasPatch] = [false, false, false];
  for (const commit of commits) {
    const semverType = config.types[commit.type]?.semverBump;
    if (semverType === 'major' || commit.isBreaking) {
      hasMajor = true;
    } else if (semverType === 'minor') {
      hasMinor = true;
    } else if (semverType === 'patch') {
      hasPatch = true;
    } else if (semverType === 'none' || !semverType) {
      // do not report a change
    }
  }

  return hasMajor ? 'major' : hasMinor ? 'minor' : hasPatch ? 'patch' : null;
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
