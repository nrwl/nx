import { valid, validRange, satisfies, coerce } from 'semver';

export function isValidRange(range: string) {
  // valid() will return null if a range (including ~,^,*) is used
  // Check that it is null, and therefore a range
  return !valid(range) && validRange(range) !== null;
}

export function isMatchingDependencyRange(version: string, range: string) {
  const coercedVersion = coerce(version, { includePrerelease: true })?.version;
  return isValidRange(range) && satisfies(coercedVersion, range);
}
