import { validRange, satisfies } from 'semver';

const SEMVER_RANGE_REGEX =
  /^[\^~*]|[<>=]+|\s*-\s*|\|\||\.x|\.X|\.\*|^\d+$|^\d+\.\d+$/;
export function isRange(currentVersion: string) {
  return SEMVER_RANGE_REGEX.test(currentVersion);
}

export function satisfiesRange(version: string, range: string) {
  return validRange(range) !== null && satisfies(version, range);
}
