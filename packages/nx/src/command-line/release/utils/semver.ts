import { RELEASE_TYPES, ReleaseType, inc, valid } from 'semver';

export function isRelativeVersionKeyword(val: string): val is ReleaseType {
  return RELEASE_TYPES.includes(val as ReleaseType);
}

export function deriveNewSemverVersion(
  currentSemverVersion: string,
  semverSpecifier: string
) {
  if (!valid(currentSemverVersion)) {
    throw new Error(
      `Invalid semver version "${currentSemverVersion}" provided.`
    );
  }

  let newVersion = semverSpecifier;
  if (isRelativeVersionKeyword(semverSpecifier)) {
    // Derive the new version from the current version combined with the new version specifier.
    const derivedVersion = inc(currentSemverVersion, semverSpecifier);
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
