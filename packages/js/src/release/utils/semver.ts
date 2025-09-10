import { valid, validRange, satisfies } from 'semver';

export function isMatchingDependencyRange(version: string, range: string) {
  // valid() will return null if a range (including ~,^,*) is used
  // Check that it is null, and therefore a range
  return (
    !valid(range) && validRange(range) !== null && satisfies(version, range)
  );
}
